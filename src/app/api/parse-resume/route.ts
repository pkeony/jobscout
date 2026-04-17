import { NextResponse } from "next/server";
import { UserProfileSchema } from "@/types";
import { stream } from "@/lib/ai";
import { validateFile, extractText } from "@/lib/parse/extract-text";
import {
  RESUME_PARSE_SYSTEM_PROMPT,
  buildResumeParseMessages,
  extractResumeJson,
} from "@/lib/prompts/parse-resume";

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

  if (!file) {
    return NextResponse.json(
      { error: "파일이 없습니다" },
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

  let text: string;
  try {
    text = await extractText(buffer, file.type);
  } catch {
    return NextResponse.json(
      { error: "파일에서 텍스트를 추출하지 못했습니다" },
      { status: 422 },
    );
  }

  if (text.trim().length < 20) {
    return NextResponse.json(
      { error: "파일에서 텍스트를 충분히 추출하지 못했습니다. 텍스트 기반 문서를 사용해주세요." },
      { status: 422 },
    );
  }

  const messages = buildResumeParseMessages(text);

  let fullText = "";
  for await (const event of stream(apiKey, messages, {
    model: "gemini-2.5-flash",
    system: RESUME_PARSE_SYSTEM_PROMPT,
    temperature: 0,
    maxTokens: 2048,
    bufferedFallback: true,
  })) {
    if (event.type === "delta") fullText += event.text;
  }

  try {
    const raw = extractResumeJson(fullText);
    const profile = UserProfileSchema.parse(raw);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: "프로필 추출에 실패했습니다. 직접 입력해주세요." },
      { status: 422 },
    );
  }
}
