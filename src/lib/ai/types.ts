export type ModelId = "gemini-2.5-flash";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: ModelId;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: AiUsage; model: ModelId };
