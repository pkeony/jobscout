import type { AiMessage } from "@/lib/ai/types";
import type { AnalysisResult, UserProfile } from "@/types";
import { MatchResultSchema, type MatchResult } from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const PROMPT_VERSION = "match@v1.0.0-2026-04-19";

export const MATCH_SYSTEM_PROMPT = `당신은 채용공고-지원자 매칭 전문가입니다.
채용공고(JD) 텍스트와 지원자 프로필을 비교 분석하여 매칭 결과를 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`)으로 감싸지 마세요.
2. 아래 JSON 스키마를 정확히 따르세요.
3. 한국어로 작성하세요.

## 입력 우선순위
"JD 분석 결과 (primary source)" 섹션이 제공되면 이를 정답 소스로 사용하세요. 그 안의 requirements는 필수 스킬 매칭 기준, preferredRequirements는 우대 매칭 기준, experienceLevel은 경력 매칭 기준입니다. JD 원문 미리보기는 보조 컨텍스트로만 사용. 분석 결과가 없으면 채용공고 원문을 직접 파싱하세요.

## JD 근거 원칙 (반드시 지킬 것)
skillMatches의 "name"은 다음 중 하나여야 합니다.
- JD 분석 결과(requirements / preferredRequirements)에 명시된 스킬
- 또는 JD 원문에 문자 그대로 등장한 기술·도구·역량

JD에 없는 스킬을 추정으로 추가하지 마세요. 예를 들어 JD에 "ChatGPT", "Claude"라는 단어가 없는데 "AI 직무니까 당연히 필요할 것" 같은 일반화로 항목을 만들어내는 것은 금지입니다. JD가 모호하면 summary에 한계를 명시하되, 프로필에서 JD의 실제 요구와 연관성이 확실한 역량은 strengths와 skillMatches에 정상적으로 반영하세요 (JD 한계가 강점 평가를 깎는 이유가 되면 안 됨).

## focusPosition 처리
"사용자가 집중 분석을 요청한 포지션"이 명시되면 그 포지션 관점에서 매칭하세요. JD 분석 결과가 비어 있거나 skills가 적더라도:
- focusPosition 텍스트에서 요구 역량/업무를 직접 추출하고
- 사용자 프로필의 관련 경험·스킬과 비교해 skillMatches를 **최소 3개 이상** 생성하세요.

focusPosition이 있을 때 skillMatches를 []로 두는 것은 금지입니다.

## JSON 스키마
{
  "score": 0~100 (정수, 매칭 점수),
  "scoreBreakdown": {
    "requiredSkills": { "earned": 0, "max": 0 },
    "preferredSkills": { "earned": 0, "max": 0 },
    "experience": { "earned": 0, "max": 10 },
    "base": 20
  },
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

## scoreBreakdown 출력 규칙 (필수 — 불변식 위반 시 결과가 무효 처리됩니다)
score를 항목별로 분해해 반드시 함께 출력하세요. 사용자에게 산정 근거를 보여주기 위함.

**정의**
- requiredSkills.max  = JD 필수 스킬 수 × 15
- requiredSkills.earned = (필수 match 수 × 15) + (필수 partial 수 × 7)
- preferredSkills.max = JD 우대 스킬 수 × 5
- preferredSkills.earned = (우대 match 수 × 5) + (우대 partial 수 × 3)
- experience.max = 10 (고정)
- experience.earned = 0 / 5 / 10 중 하나 (경력 요건 부합도; 미달=0, 부분충족=5, 충족=10)
- base = 20 (고정)

**불변식 (출력 전 셀프 체크)**
1. requiredSkills.earned ≤ requiredSkills.max
2. preferredSkills.earned ≤ preferredSkills.max
3. experience.earned ∈ {0, 5, 10}, experience.max == 10
4. base == 20
5. **등식:** score == min(100, requiredSkills.earned + preferredSkills.earned + experience.earned + base)

이 등식이 맞지 않으면 score를 바꾸지 말고 earned 값을 조정해 등식을 성립시키세요. skillMatches의 match/partial 수와 earned 값이 실제로 일치하도록 점검하세요.

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
  const result = MatchResultSchema.parse(parsed);
  return normalizeBreakdown(result);
}

// LLM이 프롬프트 지시에도 불구하고 산수(earned ≤ max, sum == score)를 못 맞추는
// 실측 (eval 기준 sanity 10-60%). UX 핵심인 "breakdown이 score 근거" 불변식을
// 코드 레벨에서 강제.
function normalizeBreakdown(result: MatchResult): MatchResult {
  const b = result.scoreBreakdown;
  if (!b) return result;

  b.requiredSkills.earned = clamp(b.requiredSkills.earned, 0, b.requiredSkills.max);
  b.preferredSkills.earned = clamp(b.preferredSkills.earned, 0, b.preferredSkills.max);
  b.experience.max = 10;
  b.experience.earned = snapTo(b.experience.earned, [0, 5, 10]);
  b.base = 20;

  const sum =
    b.requiredSkills.earned +
    b.preferredSkills.earned +
    b.experience.earned +
    b.base;
  result.score = clamp(sum, 0, 100);

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function snapTo(value: number, options: number[]): number {
  return options.reduce((best, v) =>
    Math.abs(v - value) < Math.abs(best - value) ? v : best,
  );
}
