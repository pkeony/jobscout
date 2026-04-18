import { NextResponse } from "next/server";
import { CoverLetterRequestSchema, type CoverLetterResult } from "@/types";
import { streamToJson, makeUsage, type StreamEvent } from "@/lib/ai";
import { COVER_LETTER_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import { createSSEStream, sseResponse } from "@/lib/sse";
import {
  COVER_LETTER_SYSTEM_PROMPT,
  COVER_LETTER_CRITIQUE_SYSTEM_PROMPT,
  buildCoverLetterMessages,
  buildCoverLetterCritiqueMessages,
  extractCoverLetterJson,
  normalizeCoverLetter,
} from "@/lib/prompts/cover-letter";

const MAX_JD_LENGTH = 30_000;

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "서버에 API Key가 설정되지 않았습니다" },
      { status: 500 },
    );
  }

  const body: unknown = await req.json();
  const parsed = CoverLetterRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const { jdText, profile, analysisResult, focusPosition } = parsed.data;
  const jd = jdText.slice(0, MAX_JD_LENGTH);
  const doublePass = process.env.COVER_LETTER_DOUBLE_PASS === "1";
  const reqId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  console.log(
    `[cover-letter ${reqId}] start jdLen=${jd.length} analysis=${!!analysisResult} focus=${!!focusPosition} doublePass=${doublePass}`,
  );

  async function* run(): AsyncIterable<StreamEvent> {
    const draftMessages = buildCoverLetterMessages(jd, profile, {
      analysisResult,
      focusPosition,
    });

    const draft = await streamToJson<CoverLetterResult>(
      apiKey!,
      draftMessages,
      {
        model: "gemini-2.5-flash",
        system: COVER_LETTER_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 4096,
        responseJson: { schema: COVER_LETTER_RESPONSE_SCHEMA },
        signal: req.signal,
      },
      extractCoverLetterJson,
    );

    let final = normalizeCoverLetter(draft.result);
    let tokensIn = draft.tokensIn;
    let tokensOut = draft.tokensOut;
    let model = draft.model;

    if (doublePass) {
      try {
        const critiqueMessages = buildCoverLetterCritiqueMessages(final, jd, profile, {
          analysisResult,
          focusPosition,
        });
        const refined = await streamToJson<CoverLetterResult>(
          apiKey!,
          critiqueMessages,
          {
            model: "gemini-2.5-flash",
            system: COVER_LETTER_CRITIQUE_SYSTEM_PROMPT,
            temperature: 0.2,
            maxTokens: 4096,
            responseJson: { schema: COVER_LETTER_RESPONSE_SCHEMA },
            signal: req.signal,
          },
          extractCoverLetterJson,
        );
        final = normalizeCoverLetter(refined.result);
        tokensIn += refined.tokensIn;
        tokensOut += refined.tokensOut;
        model = refined.model;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[cover-letter ${reqId}] pass2 실패 → pass1 결과로 fallback: ${message}`);
      }
    }

    const latencyMs = Date.now() - startMs;
    console.log(
      `[cover-letter ${reqId}] done sections=${final.sections.length} tokens=${tokensIn}/${tokensOut} latency=${latencyMs}ms`,
    );

    yield { type: "delta", text: JSON.stringify(final) };
    yield { type: "done", usage: makeUsage(model, tokensIn, tokensOut), model };
  }

  const sseStream = createSSEStream(run(), req.signal);
  return sseResponse(sseStream);
}
