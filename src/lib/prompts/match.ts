import type { AiMessage } from "@/lib/ai/types";
import type { AnalysisResult, UserProfile } from "@/types";
import { MatchResultSchema, type MatchResult } from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const MATCH_SYSTEM_PROMPT = `당신은 채용공고-지원자 매칭 전문가입니다.
채용공고(JD) 텍스트와 지원자 프로필을 비교 분석하여 매칭 결과를 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`)으로 감싸지 마세요.
2. 아래 JSON 스키마를 정확히 따르세요.
3. 한국어로 작성하세요.

## 입력 우선순위
"JD 분석 결과 (primary source)" 섹션이 제공되면 이를 정답 소스로 사용하세요. 그 안의 requirements는 필수 스킬 매칭 기준, preferredRequirements는 우대 매칭 기준, experienceLevel은 경력 매칭 기준입니다. JD 원문 미리보기는 보조 컨텍스트로만 사용. 분석 결과가 없으면 채용공고 원문을 직접 파싱하세요.

"사용자가 집중 분석을 요청한 포지션"이 명시되면 그 포지션 관점에서 매칭하세요.

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

JD 분석 결과의 skills 항목에는 \`level\`(beginner/intermediate/advanced/unspecified)이 함께 제공됩니다. 이는 JD가 요구하는 숙련도이므로 사용자 경력과 비교해 status를 판단하세요. 예: level=advanced인데 사용자 경험이 1년 정도면 partial, level=beginner이고 사용자가 보유했다면 match.

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
  options?: { analysisResult?: AnalysisResult; focusPosition?: string },
): AiMessage[] {
  const focusBlock = buildFocusBlock(options?.focusPosition);
  const structuredJd = buildStructuredJdBlock(options?.analysisResult);
  const rawJdSection = buildRawJdSection(jdText, Boolean(options?.analysisResult));
  const profileText = serializeProfile(profile);

  return [
    {
      role: "user",
      content: `다음 채용공고와 지원자 프로필을 매칭 분석해주세요.${focusBlock}${structuredJd}${rawJdSection}

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
