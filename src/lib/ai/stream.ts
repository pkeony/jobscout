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
export async function* stream(
  apiKey: string,
  messages: AiMessage[],
  opts: ChatOptions,
): AsyncIterable<StreamEvent> {
  const client = createClient(apiKey);
  const model = client.getGenerativeModel({ model: opts.model });

  const result = await model.generateContentStream({
    systemInstruction: opts.system ?? undefined,
    contents: toGeminiContents(messages),
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.3,
    },
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield { type: "delta", text };
    }
  }

  const final = await result.response;
  const usage = final.usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  yield {
    type: "done",
    usage: makeUsage(opts.model, inputTokens, outputTokens),
    model: opts.model,
  };
}
