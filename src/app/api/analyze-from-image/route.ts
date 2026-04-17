import { NextResponse } from "next/server";
import { stream } from "@/lib/ai";
import { createSSEStream, sseResponse } from "@/lib/sse";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildAnalyzeMessages,
} from "@/lib/prompts/analyze";
import { ocrImagesToText } from "@/lib/vision/ocr";
import type { FetchedImage } from "@/lib/vision/fetch-image";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "폼 데이터를 읽을 수 없습니다" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "이미지 파일이 없습니다" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `이미지는 최대 ${MAX_FILES}장까지 가능합니다` },
      { status: 400 },
    );
  }

  const images: FetchedImage[] = [];
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `지원되지 않는 이미지 형식: ${file.type || "unknown"}. PNG/JPEG/WEBP만 가능합니다.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `이미지 크기 초과: ${file.name} (최대 10MB)` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({
      mimeType: file.type,
      data: buffer.toString("base64"),
      bytes: buffer.byteLength,
    });
  }

  let ocrText: string;
  try {
    const result = await ocrImagesToText(apiKey, images, { signal: req.signal });
    ocrText = result.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR 실패";
    return NextResponse.json(
      { error: `이미지에서 텍스트 추출 실패: ${message}` },
      { status: 502 },
    );
  }

  if (ocrText.length < 50) {
    return NextResponse.json(
      { error: "이미지에서 충분한 텍스트를 추출하지 못했습니다. 더 선명한 이미지를 사용해주세요." },
      { status: 422 },
    );
  }

  const messages = buildAnalyzeMessages(ocrText);
  const generator = stream(apiKey, messages, {
    model: "gemini-2.5-flash",
    system: ANALYZE_SYSTEM_PROMPT,
    temperature: 0,
    maxTokens: 16384,
    signal: req.signal,
    bufferedFallback: true,
  });

  const sseStream = createSSEStream(generator, req.signal);
  return sseResponse(sseStream);
}
