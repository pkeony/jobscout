import type { AiMessage } from "@/lib/ai/types";

export const DETECT_POSITIONS_SYSTEM_PROMPT = `채용공고에서 모집 중인 포지션 목록을 추출합니다.

## 출력 규칙
유효한 JSON만 출력. 마크다운 코드블록 금지.
다음 스키마: { "positions": ["포지션명1", "포지션명2", ...] }

## 추출 규칙
- **포지션/직무/역할 단위**로 추출. 같은 직무의 지역/조건 변형(예: 기술영업-경기, 기술영업-경남)도 별개로 취급.
- 같은 포지션은 중복 제거.
- 포지션명은 원문 그대로. 가능하면 부서/파트 접두어 포함 (예: "인프라 파트 - 테크베이 정비 매니저").
- 단일 포지션만 있는 공고면 배열에 1개만.
- 부서/파트만 나열된 경우, 각 부서 자체를 포지션으로 간주 금지 — 실제 세부 직무명 있을 때만 포함.
- 포지션이 명확히 식별되지 않으면 빈 배열 반환: { "positions": [] }.

## 예시
입력:
"[인프라 파트] • 테크베이 정비 매니저 • 테크베이 정비사
 [생산 파트] • 진단 팀원 • 관제 팀원"
출력:
{ "positions": ["인프라 파트 - 테크베이 정비 매니저", "인프라 파트 - 테크베이 정비사", "생산 파트 - 진단 팀원", "생산 파트 - 관제 팀원"] }

입력:
"백엔드 개발자 모집. Node.js 3년 이상."
출력:
{ "positions": ["백엔드 개발자"] }`;

export function buildDetectPositionsMessages(jdText: string): AiMessage[] {
  return [
    {
      role: "user",
      content: `다음 채용공고에서 모집 포지션 목록을 추출해주세요:\n\n${jdText}`,
    },
  ];
}

export function parsePositionsJson(raw: string): string[] {
  let cleaned = raw.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(cleaned) as { positions?: unknown };
    if (!Array.isArray(parsed.positions)) return [];
    return parsed.positions
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  } catch {
    return [];
  }
}
