import type { ModelId, AiUsage } from "./types";

const PRICE_PER_M_TOKENS: Record<ModelId, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
};

export function calculateCost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICE_PER_M_TOKENS[model];
  if (!price) {
    throw new Error(`[ai/pricing] 미등록 모델: ${model}`);
  }
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  );
}

export function makeUsage(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
): AiUsage {
  return {
    inputTokens,
    outputTokens,
    costUsd: calculateCost(model, inputTokens, outputTokens),
  };
}
