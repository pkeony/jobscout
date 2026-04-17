import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { makeUsage } from "./pricing";
import type { AiMessage, ChatOptions, StreamEvent } from "./types";

/**
 * Gemini 클라이언트를 API Key로 생성.
 * 사용자 자체 키 모드 — 요청마다 다른 키가 올 수 있으므로 캐싱하지 않음.
 */
function createClient(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function toGeminiContents(messages: AiMessage[]): Content[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));
}

/**
 * Gemini streaming — text delta를 yield하고 완료 시 usage 포함 done 이벤트.
 */
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("503") || err.message.includes("429") || err.message.includes("overloaded");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* stream(
  apiKey: string,
  messages: AiMessage[],
  opts: ChatOptions,
): AsyncIterable<StreamEvent> {
  const client = createClient(apiKey);
  const model = client.getGenerativeModel({ model: opts.model });

  const request = {
    systemInstruction: opts.system ?? undefined,
    contents: toGeminiContents(messages),
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.3,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[Gemini] 재시도 ${attempt}/${MAX_RETRIES} (${delay}ms 대기)...`);
      await sleep(delay);
    }

    try {
      const result = await model.generateContentStream(request);

      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield { type: "delta", text };
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "스트리밍 오류";
        console.error("[Gemini stream error]", message);
      }

      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const final = await result.response;
        const usage = final.usageMetadata;
        inputTokens = usage?.promptTokenCount ?? 0;
        outputTokens = usage?.candidatesTokenCount ?? 0;
      } catch {
        // response 조회 실패 시 usage 0으로 진행
      }

      yield {
        type: "done",
        usage: makeUsage(opts.model, inputTokens, outputTokens),
        model: opts.model,
      };
      return; // 성공 시 종료
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!isRetryable(err) || attempt === MAX_RETRIES) {
        throw lastError;
      }
    }
  }
}
