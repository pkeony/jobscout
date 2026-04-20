import { NextResponse } from "next/server";
import {
  CoverLetterRefineRequestSchema,
  CoverLetterRefineResultSchema,
  type CoverLetterRefineResult,
} from "@/types";
import { streamToJson, makeUsage, type StreamEvent } from "@/lib/ai";
import { COVER_LETTER_REFINE_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { withCredit } from "@/lib/billing/withCredit";
import {
  COVER_LETTER_REFINE_SYSTEM_PROMPT,
  buildCoverLetterRefineMessages,
  extractCoverLetterRefineJson,
  normalizeCoverLetterRefine,
} from "@/lib/prompts/cover-letter-refine";

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
  const parsed = CoverLetterRefineRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const { coverLetter, weaknesses, jdText, profile, analysisResult, focusPosition } =
    parsed.data;
  const jd = jdText.slice(0, MAX_JD_LENGTH);
  const inputWeaknessIds = weaknesses.map((w) => w.id);
  const reqId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  console.log(
    `[cover-letter-refine ${reqId}] start jdLen=${jd.length} weaknesses=${weaknesses.length} sections=${coverLetter.sections.length}`,
  );

  async function* run(): AsyncIterable<StreamEvent> {
    const messages = buildCoverLetterRefineMessages(coverLetter, weaknesses, jd, {
      profile,
      analysisResult,
      focusPosition,
    });
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const r = await streamToJson<CoverLetterRefineResult>(
          apiKey!,
          messages,
          {
            model: "gemini-2.5-flash",
            system: COVER_LETTER_REFINE_SYSTEM_PROMPT,
            temperature: attempt === 1 ? 0.1 : 0.0,
            maxTokens: 8192,
            responseJson: { schema: COVER_LETTER_REFINE_RESPONSE_SCHEMA },
            signal: req.signal,
          },
          extractCoverLetterRefineJson,
        );
        const normalized = normalizeCoverLetterRefine(r.result, inputWeaknessIds);
        const final = CoverLetterRefineResultSchema.parse(normalized);
        const latencyMs = Date.now() - startMs;
        console.log(
          `[cover-letter-refine ${reqId}] done attempts=${attempt} appliedWeaknesses=${final.appliedWeaknessIds.length} changeNotes=${final.changeNotes.length} tokens=${r.tokensIn}/${r.tokensOut} latency=${latencyMs}ms`,
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
          `[cover-letter-refine ${reqId}] attempt ${attempt} 실패: ${lastError.slice(0, 200)}`,
        );
      }
    }

    throw new Error(lastError ?? "cover-letter-refine 생성 실패");
  }

  const sseStream = createSSEStream(run(), req.signal);
  return sseResponse(sseStream);
}

export const POST = withCredit("api_cover_letter_refine", handler);
