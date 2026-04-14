import { NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/types";
import { stream } from "@/lib/ai";
import { createSSEStream, sseResponse } from "@/lib/sse";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildAnalyzeMessages,
} from "@/lib/prompts/analyze";

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const body: unknown = await req.json();
  const parsed = AnalyzeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const { text } = parsed.data;
  const messages = buildAnalyzeMessages(text);

  const generator = stream(apiKey, messages, {
    model: "gemini-2.5-flash",
    system: ANALYZE_SYSTEM_PROMPT,
    temperature: 0.1,
    maxTokens: 4096,
    signal: req.signal,
  });

  const sseStream = createSSEStream(generator, req.signal);
  return sseResponse(sseStream);
}
