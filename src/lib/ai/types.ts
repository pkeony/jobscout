export type ModelId =
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type AiMessagePart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string | AiMessagePart[];
}

export interface JsonResponseSpec {
  // Gemini Schema(OpenAPI 3.0 서브셋). SDK 타입 의존을 이 파일에서 하지 않기 위해 unknown.
  // 실제 작성은 src/lib/ai/schemas.ts에서, 전달은 stream.ts에서 config.responseSchema로.
  schema?: unknown;
}

export interface ChatOptions {
  model: ModelId;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /**
   * JSON 응답 강제.
   * - true: responseMimeType="application/json" (스키마 없이 JSON만 강제)
   * - object: responseMimeType + responseSchema 동시 지정 (SDK가 스키마 위반 출력 거부)
   */
  responseJson?: boolean | JsonResponseSpec;
  /**
   * true일 경우 delta를 메모리에 buffer하고 stream이 완료된 후에만 client로 emit.
   * mid-stream 끊김 시에도 폴백 모델로 재시도 가능 (JSON 응답 등 중간 스트리밍이 의미 없는 경우 권장).
   */
  bufferedFallback?: boolean;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: AiUsage; model: ModelId };
