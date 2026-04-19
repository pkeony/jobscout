import { NextResponse } from "next/server";
import {
  AnalysisResultSchema,
  type AnalysisResult,
  type ImproveCoverLetterResult,
} from "@/types";
import { streamToJson, makeUsage, type StreamEvent } from "@/lib/ai";
import { IMPROVE_COVER_LETTER_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { validateFile, extractText } from "@/lib/parse/extract-text";
import {
  IMPROVE_COVER_LETTER_SYSTEM_PROMPT,
  buildImproveCoverLetterMessages,
  extractImproveCoverLetterJson,
} from "@/lib/prompts/improve-cover-letter";

const MAX_JD_LENGTH = 30_000;

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
  const jdTextRaw = formData.get("jdText") as string | null;
  const analysisRaw = formData.get("analysisResult");
  const focusRaw = formData.get("focusPosition");

  if (!file || !jdTextRaw) {
    return NextResponse.json(
      { error: "파일과 채용공고가 필요합니다" },
      { status: 400 },
    );
  }

  let analysisResult: AnalysisResult | undefined;
  if (typeof analysisRaw === "string" && analysisRaw.length > 0) {
    try {
      const parsed = AnalysisResultSchema.safeParse(JSON.parse(analysisRaw));
      if (parsed.success) analysisResult = parsed.data;
    } catch {
      // stale 캐시 / malformed JSON 은 무시하고 JD 원문만으로 진행
    }
  }
  const focusPosition = typeof focusRaw === "string" && focusRaw.length > 0 ? focusRaw : undefined;

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

  const jdText = jdTextRaw.slice(0, MAX_JD_LENGTH);
  const reqId = crypto.randomUUID().slice(0, 8);
  const startMs = Date.now();

  console.log(
    `[improve-cover-letter ${reqId}] start fileSize=${file.size} clLen=${coverLetterText.length} jdLen=${jdText.length} structuredJd=${analysisResult ? "Y" : "N"} focus=${focusPosition ? "Y" : "N"}`,
  );

  async function* run(): AsyncIterable<StreamEvent> {
    const messages = buildImproveCoverLetterMessages(coverLetterText, jdText, {
      analysisResult,
      focusPosition,
    });

    const result = await streamToJson<ImproveCoverLetterResult>(
      apiKey!,
      messages,
      {
        model: "gemini-2.5-flash",
        system: IMPROVE_COVER_LETTER_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 6144,
        responseJson: { schema: IMPROVE_COVER_LETTER_RESPONSE_SCHEMA },
        signal: req.signal,
      },
      extractImproveCoverLetterJson,
    );

    const latencyMs = Date.now() - startMs;
    console.log(
      `[improve-cover-letter ${reqId}] done suggestions=${result.result.suggestions.length} missing=${result.result.missingFromJd.length} tokens=${result.tokensIn}/${result.tokensOut} latency=${latencyMs}ms`,
    );

    yield { type: "delta", text: JSON.stringify(result.result) };
    yield { type: "done", usage: makeUsage(result.model, result.tokensIn, result.tokensOut), model: result.model };
  }

  const sseStream = createSSEStream(run(), req.signal);
  return sseResponse(sseStream);
}
