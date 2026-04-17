import { stream } from "@/lib/ai";
import {
  DETECT_POSITIONS_SYSTEM_PROMPT,
  buildDetectPositionsMessages,
  parsePositionsJson,
} from "@/lib/prompts/detect-positions";

/**
 * 채용공고 텍스트에서 모집 포지션 목록을 추출.
 * 실패 시 빈 배열 반환 (크롤 자체는 막지 않음).
 */
export async function detectPositions(apiKey: string, jdText: string): Promise<string[]> {
  const messages = buildDetectPositionsMessages(jdText);

  let fullText = "";
  try {
    for await (const event of stream(apiKey, messages, {
      model: "gemini-2.5-flash",
      system: DETECT_POSITIONS_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 1024,
      bufferedFallback: true,
    })) {
      if (event.type === "delta") fullText += event.text;
    }
  } catch (err) {
    console.warn("[detect-positions] 실패:", err instanceof Error ? err.message : err);
    return [];
  }

  return parsePositionsJson(fullText);
}
