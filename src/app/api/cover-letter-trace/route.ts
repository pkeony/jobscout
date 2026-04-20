import { NextResponse } from "next/server";
import {
  CoverLetterTraceRequestSchema,
  CoverLetterTraceResultSchema,
  type CoverLetterTraceResult,
} from "@/types";
import { streamToJson, makeUsage, type StreamEvent } from "@/lib/ai";
import { COVER_LETTER_TRACE_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { withCredit } from "@/lib/billing/withCredit";
import {
  COVER_LETTER_TRACE_SYSTEM_PROMPT,
  buildCoverLetterTraceMessages,
  extractCoverLetterTraceJson,
  normalizeCoverLetterTrace,
} from "@/lib/prompts/cover-letter-trace";

const MAX_JD_LENGTH = 30_000;
const MAX_ATTEMPTS = 2;

async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const body: unknown = await req.json();
  const parsed = CoverLetterTraceRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const { coverLetter, interviewResult, jdText, profile, analysisResult, focusPosition } =
    parsed.data;
  const jd = jdText.slice(0, MAX_JD_LENGTH);
  const reqId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  console.log(
    `[cover-letter-trace ${reqId}] start jdLen=${jd.length} weaknessSourceQuestions=${interviewResult.questions.length} sections=${coverLetter.sections.length}`,
  );

  async function* run(): AsyncIterable<StreamEvent> {
    const messages = buildCoverLetterTraceMessages(coverLetter, interviewResult, jd, {
      profile,
      analysisResult,
      focusPosition,
    });
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const r = await streamToJson<CoverLetterTraceResult>(
          apiKey!,
          messages,
          {
            model: "gemini-2.5-flash",
            system: COVER_LETTER_TRACE_SYSTEM_PROMPT,
            temperature: attempt === 1 ? 0.1 : 0.0,
            maxTokens: 8192,
            responseJson: { schema: COVER_LETTER_TRACE_RESPONSE_SCHEMA },
            signal: req.signal,
          },
          extractCoverLetterTraceJson,
        );
        const normalized = normalizeCoverLetterTrace(r.result);
        const final = CoverLetterTraceResultSchema.parse(normalized);
        const latencyMs = Date.now() - startMs;
        console.log(
          `[cover-letter-trace ${reqId}] done attempts=${attempt} weaknesses=${final.weaknesses.length} tokens=${r.tokensIn}/${r.tokensOut} latency=${latencyMs}ms`,
        );
        yield { type: "delta", text: JSON.stringify(final) };
        yield {
          type: "done",
          usage: makeUsage(r.model, r.tokensIn, r.tokensOut),
          model: r.model,
        };
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cover-letter-trace ${reqId}] attempt ${attempt} 실패: ${lastError.slice(0, 200)}`,
        );
      }
    }

    throw new Error(lastError ?? "cover-letter-trace 생성 실패");
  }

  const sseStream = createSSEStream(run(), req.signal);
  return sseResponse(sseStream);
}

export const POST = withCredit("api_cover_letter_trace", handler);
