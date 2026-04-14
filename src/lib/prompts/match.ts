import type { AiMessage } from "@/lib/ai/types";
import type { UserProfile } from "@/types";
import { MatchResultSchema, type MatchResult } from "@/types";

export const MATCH_SYSTEM_PROMPT = `당신은 채용공고-지원자 매칭 전문가입니다.
채용공고(JD) 텍스트와 지원자 프로필을 비교 분석하여 매칭 결과를 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`)으로 감싸지 마세요.
2. 아래 JSON 스키마를 정확히 따르세요.
3. 한국어로 작성하세요.

## JSON 스키마
{
  "score": 0~100 (정수, 매칭 점수),
  "summary": "전반적 매칭 평가 (2-3문장)",
  "strengths": ["강점1", "강점2"],
  "gaps": ["부족한 점1", "부족한 점2"],
  "skillMatches": [
    {
      "name": "스킬명",
      "status": "match | partial | gap",
      "comment": "매칭 상세 설명 (1문장)"
    }
  ],
  "advice": "지원 전략 조언 (2-3문장)"
}

## 매칭 기준
- **match**: 지원자가 해당 스킬을 보유하고 요구 수준 충족
- **partial**: 관련 경험은 있으나 수준이 부족하거나 유사 스킬로 대체 가능
- **gap**: 해당 스킬 경험 없음

## 점수 산정
- 필수 스킬 match: +15점
- 필수 스킬 partial: +7점
- 우대 스킬 match: +5점
- 우대 스킬 partial: +3점
- 경력 수준 부합: +10점
- 기본 점수 20점 (의지/잠재력)
- 100점 초과 시 100점으로 cap

## 조언
- 점수가 낮아도 부정적이지 않게, 성장 방향 제시
- 구체적으로 어떤 스킬을 보완하면 좋을지 조언`;

export function buildMatchMessages(
  jdText: string,
  profile: UserProfile,
): AiMessage[] {
  const profileText = [
    `보유 스킬: ${profile.skills.join(", ")}`,
    `경력: ${profile.experience}`,
    profile.education ? `학력: ${profile.education}` : null,
    profile.introduction ? `자기소개: ${profile.introduction}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "user",
      content: `다음 채용공고와 지원자 프로필을 매칭 분석해주세요.

## 채용공고
${jdText}

## 지원자 프로필
${profileText}`,
    },
  ];
}

export function extractMatchJson(raw: string): MatchResult {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const parsed: unknown = JSON.parse(cleaned);
  return MatchResultSchema.parse(parsed);
}
