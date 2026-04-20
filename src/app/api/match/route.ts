import { NextResponse } from "next/server";
import { MatchRequestSchema } from "@/types";
import { stream } from "@/lib/ai";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { withCredit } from "@/lib/billing/withCredit";
import { MATCH_SYSTEM_PROMPT, buildMatchMessages } from "@/lib/prompts/match";

async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const body: unknown = await req.json();
  const parsed = MatchRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const { jdText, profile, analysisResult, focusPosition } = parsed.data;
  const messages = buildMatchMessages(jdText, profile, { analysisResult, focusPosition });
  const reqId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();
  console.log(
    `[match ${reqId}] start jdLen=${jdText.length} analysis=${!!analysisResult} focus=${!!focusPosition}`,
  );

  const generator = stream(apiKey, messages, {
    model: "gemini-2.5-flash",
    system: MATCH_SYSTEM_PROMPT,
    temperature: 0,
    maxTokens: 4096,
    signal: req.signal,
    bufferedFallback: true,
  });

  async function* wrapped() {
    for await (const event of generator) {
      if (event.type === "done") {
        const latencyMs = Date.now() - startMs;
        console.log(
          `[match ${reqId}] done tokens=${event.usage.inputTokens}/${event.usage.outputTokens} latency=${latencyMs}ms`,
        );
      }
      yield event;
    }
  }

  const sseStream = createSSEStream(wrapped(), req.signal);
  return sseResponse(sseStream);
}

export const POST = withCredit("api_match", handler);
