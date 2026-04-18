import { NextResponse } from "next/server";
import {
  InterviewRequestSchema,
  InterviewResultSchema,
  type InterviewResult,
} from "@/types";
import { streamToJson, makeUsage, type StreamEvent } from "@/lib/ai";
import { INTERVIEW_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import { createSSEStream, sseResponse } from "@/lib/sse";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildInterviewMessages,
  extractInterviewJson,
  normalizeInterview,
} from "@/lib/prompts/interview";

const MAX_JD_LENGTH = 30_000;
const MAX_ATTEMPTS = 2;

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const body: unknown = await req.json();
  const parsed = InterviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const { jdText, analysisResult, focusPosition } = parsed.data;
  const jd = jdText.slice(0, MAX_JD_LENGTH);
  const reqId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  console.log(
    `[interview ${reqId}] start jdLen=${jd.length} analysis=${!!analysisResult} focus=${!!focusPosition}`,
  );

  async function* run(): AsyncIterable<StreamEvent> {
    const messages = buildInterviewMessages(jd, { analysisResult, focusPosition });
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const r = await streamToJson<InterviewResult>(
          apiKey!,
          messages,
          {
            model: "gemini-2.5-flash",
            system: INTERVIEW_SYSTEM_PROMPT,
            temperature: attempt === 1 ? 0.1 : 0.0,
            maxTokens: 8192,
            responseJson: { schema: INTERVIEW_RESPONSE_SCHEMA },
            signal: req.signal,
          },
          extractInterviewJson,
        );
        const normalized = normalizeInterview(r.result);
        const final = InterviewResultSchema.parse(normalized);
        const latencyMs = Date.now() - startMs;
        console.log(
          `[interview ${reqId}] done attempts=${attempt} tokens=${r.tokensIn}/${r.tokensOut} latency=${latencyMs}ms`,
        );
        yield { type: "delta", text: JSON.stringify(final) };
        yield { type: "done", usage: makeUsage(r.model, r.tokensIn, r.tokensOut), model: r.model };
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[interview ${reqId}] attempt ${attempt} 실패: ${lastError.slice(0, 200)}`);
      }
    }

    throw new Error(lastError ?? "interview 생성 실패");
  }

  const sseStream = createSSEStream(run(), req.signal);
  return sseResponse(sseStream);
}
