import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { makeUsage } from "./pricing";
import { geminiBreaker, CircuitOpenError } from "./circuit-breaker";
import type {
  AiMessage,
  AiMessagePart,
  ChatOptions,
  ModelId,
  StreamEvent,
} from "./types";

function createClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

function partToGemini(part: AiMessagePart): Part {
  if (part.type === "text") return { text: part.text };
  return { inlineData: { mimeType: part.mimeType, data: part.data } };
}

function toGeminiContents(messages: AiMessage[]): Content[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts:
        typeof m.content === "string"
          ? [{ text: m.content }]
          : m.content.map(partToGemini),
    }));
}

const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 15_000;
const EARLY_STREAM_FAIL_MARKER = "early_stream_failure";

const FALLBACK_CHAIN: readonly ModelId[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("503") ||
    err.message.includes("429") ||
    err.message.includes("overloaded") ||
    err.message.includes(EARLY_STREAM_FAIL_MARKER)
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequest(model: ModelId, messages: AiMessage[], opts: ChatOptions) {
  const config: {
    systemInstruction?: string;
    maxOutputTokens: number;
    temperature: number;
    thinkingConfig: { thinkingBudget: number };
    abortSignal?: AbortSignal;
    responseMimeType?: string;
    responseSchema?: unknown;
  } = {
    systemInstruction: opts.system,
    maxOutputTokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0,
    thinkingConfig: { thinkingBudget: 512 },
    abortSignal: opts.signal,
  };

  if (opts.responseJson) {
    config.responseMimeType = "application/json";
    if (typeof opts.responseJson === "object" && opts.responseJson.schema) {
      config.responseSchema = opts.responseJson.schema;
    }
  }

  return {
    model,
    contents: toGeminiContents(messages),
    config,
  };
}

/**
 * 단일 모델에 대해 retry 포함 스트리밍 시도.
 * 첫 delta 이전 실패는 isRetryable 조건으로 재시도.
 * 첫 delta 이후 실패는 마지막 done 이벤트만 발행 (client가 파싱 실패로 감지).
 */
async function* streamSingleModel(
  client: GoogleGenAI,
  model: ModelId,
  messages: AiMessage[],
  opts: ChatOptions,
): AsyncIterable<StreamEvent> {
  const request = buildRequest(model, messages, opts);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(
        MAX_RETRY_DELAY_MS,
        RETRY_DELAY_MS * Math.pow(2, attempt - 1),
      );
      console.log(`[Gemini:${model}] 재시도 ${attempt}/${MAX_RETRIES} (${delay}ms)`);
      await sleep(delay);
    }

    try {
      const response = await client.models.generateContentStream(request);
      const buffered = opts.bufferedFallback ?? false;
      const bufferedDeltas: string[] = [];
      let yieldedAny = false;
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            if (buffered) {
              bufferedDeltas.push(text);
            } else {
              yieldedAny = true;
              yield { type: "delta", text };
            }
          }
          const usage = chunk.usageMetadata;
          if (usage) {
            inputTokens = usage.promptTokenCount ?? inputTokens;
            outputTokens = usage.candidatesTokenCount ?? outputTokens;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "스트리밍 오류";
        console.error(`[Gemini:${model} stream error]`, message);
        if (buffered) {
          // 버퍼링 모드: 중간 실패 전부 retryable → 전체 재시도 또는 다음 모델
          throw new Error(`${EARLY_STREAM_FAIL_MARKER}: ${message}`);
        }
        if (!yieldedAny) {
          throw new Error(`${EARLY_STREAM_FAIL_MARKER}: ${message}`);
        }
        // 스트리밍 모드에서 이미 일부 yield 됨 → 클라이언트가 파싱 실패로 처리
      }

      // 버퍼링 모드: 완료 시 축적된 content를 한 번에 emit
      if (buffered && bufferedDeltas.length > 0) {
        yield { type: "delta", text: bufferedDeltas.join("") };
      }

      yield {
        type: "done",
        usage: makeUsage(model, inputTokens, outputTokens),
        model,
      };
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isRetryable(err)) {
        console.log(`[Gemini:${model}] non-retryable 에러 → 즉시 실패: ${lastError.message.slice(0, 120)}`);
        throw lastError;
      }
      if (attempt === MAX_RETRIES) {
        console.log(`[Gemini:${model}] MAX_RETRIES(${MAX_RETRIES}) 소진 → throw (다음 모델로 폴백)`);
        throw lastError;
      }
    }
  }
}

/**
 * 폴백 체인 + 서킷 브레이커가 적용된 스트리밍.
 * - flash → flash-lite 순차 시도
 * - 첫 delta 이후엔 모델 전환 불가 (클라이언트 중복 수신 방지)
 * - 연속 실패 시 서킷 open → 일정 시간 요청 자체 거부
 */
export async function* stream(
  apiKey: string,
  messages: AiMessage[],
  opts: ChatOptions,
): AsyncIterable<StreamEvent> {
  if (!geminiBreaker.canAttempt()) {
    throw new CircuitOpenError(geminiBreaker.getRemainingCooldownSec());
  }

  const client = createClient(apiKey);
  const models = opts.model === "gemini-2.5-flash"
    ? FALLBACK_CHAIN
    : [opts.model];

  let lastError: Error | null = null;

  console.log(`[Gemini] 폴백 체인 시작: [${models.join(" → ")}]`);

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    let yieldedAnyForModel = false;
    console.log(`[Gemini] (${i + 1}/${models.length}) ${model} 시도`);
    try {
      for await (const event of streamSingleModel(client, model, messages, opts)) {
        if (event.type === "delta") yieldedAnyForModel = true;
        yield event;
      }
      geminiBreaker.recordSuccess();
      console.log(`[Gemini] ${model} 성공 ✓`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (yieldedAnyForModel) {
        // 이미 client에 delta 보냄 → 모델 전환 불가, 실패 확정
        geminiBreaker.recordFailure();
        console.log(`[Gemini] ${model} mid-stream 실패 (delta 이미 전송) → 폴백 불가, 실패 확정`);
        throw lastError;
      }
      const hasNext = i < models.length - 1;
      if (hasNext) {
        console.log(`[Gemini] ${model} 조기 실패 → 다음 모델(${models[i + 1]})로 폴백`);
      } else {
        console.log(`[Gemini] ${model} 실패 + 폴백 대상 없음`);
      }
    }
  }

  geminiBreaker.recordFailure();
  throw lastError ?? new Error("모든 모델이 응답하지 않습니다");
}

export interface JsonStreamResult<T> {
  result: T;
  tokensIn: number;
  tokensOut: number;
  model: ModelId;
}

/**
 * 버퍼링 스트림으로 전체 응답을 모아 JSON으로 파싱. cover-letter/interview 같이
 * 중간 렌더가 의미 없는 JSON 응답 엔드포인트가 공유.
 */
export async function streamToJson<T>(
  apiKey: string,
  messages: AiMessage[],
  opts: ChatOptions,
  parse: (raw: string) => T,
): Promise<JsonStreamResult<T>> {
  let fullText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let model: ModelId = opts.model;
  for await (const event of stream(apiKey, messages, { ...opts, bufferedFallback: true })) {
    if (event.type === "delta") fullText += event.text;
    if (event.type === "done") {
      tokensIn = event.usage.inputTokens;
      tokensOut = event.usage.outputTokens;
      model = event.model;
    }
  }
  return { result: parse(fullText), tokensIn, tokensOut, model };
}
