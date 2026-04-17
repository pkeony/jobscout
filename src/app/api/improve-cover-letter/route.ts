import { NextResponse } from "next/server";
import { stream } from "@/lib/ai";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { validateFile, extractText } from "@/lib/parse/extract-text";
import {
  IMPROVE_COVER_LETTER_SYSTEM_PROMPT,
  buildImproveCoverLetterMessages,
} from "@/lib/prompts/improve-cover-letter";

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const jdText = formData.get("jdText") as string | null;

  if (!file || !jdText) {
    return NextResponse.json(
      { error: "파일과 JD가 필요합니다" },
      { status: 400 },
    );
  }

  const validation = validateFile(file);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let coverLetterText: string;
  try {
    coverLetterText = await extractText(buffer, file.type);
  } catch {
    return NextResponse.json(
      { error: "파일에서 텍스트를 추출하지 못했습니다" },
      { status: 422 },
    );
  }

  if (coverLetterText.trim().length < 20) {
    return NextResponse.json(
      { error: "파일에서 텍스트를 충분히 추출하지 못했습니다" },
      { status: 422 },
    );
  }

  const messages = buildImproveCoverLetterMessages(coverLetterText, jdText);

  const generator = stream(apiKey, messages, {
    model: "gemini-2.5-flash",
    system: IMPROVE_COVER_LETTER_SYSTEM_PROMPT,
    temperature: 0.4,
    maxTokens: 4096,
    signal: req.signal,
  });

  const sseStream = createSSEStream(generator, req.signal);
  return sseResponse(sseStream);
}
