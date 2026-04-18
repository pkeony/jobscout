import Anthropic from "@anthropic-ai/sdk";
import { JudgeScoreSchema, type JudgeScore } from "../types";

export const JUDGE_MODEL = "claude-haiku-4-5";

let cachedClient: Anthropic | null = null;

export function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 추가하세요.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

function stripCodeBlock(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

function extractFirstJson(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return text;
  return text.slice(first, last + 1);
}

export function parseJudgeResponse(raw: string): JudgeScore {
  const cleaned = extractFirstJson(stripCodeBlock(raw));
  const parsed: unknown = JSON.parse(cleaned);
  return JudgeScoreSchema.parse(parsed);
}

export async function callJudge(
  system: string,
  userContent: string,
  maxTokens = 512,
): Promise<JudgeScore> {
  const client = getClient();
  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlocks = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!textBlocks) {
    throw new Error("[judge] Claude 응답에 text block이 없음");
  }

  return parseJudgeResponse(textBlocks);
}
