import type { AiMessage } from "@/lib/ai/types";
import type { AnalysisResult, UserProfile } from "@/types";
import { MatchResultSchema, type MatchResult } from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const PROMPT_VERSION = "match@v1.2.0-2026-04-19";

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
**게이트:** 이 섹션의 절차는 입력 메시지에 "## 사용자가 집중 분석을 요청한 포지션" 이라는 섹션이 실제로 포함되어 있을 때에만 적용합니다. 그 섹션이 없으면 이 'focusPosition 처리' 섹션 전체를 무시하고 '## 점수 산정' 의 기본 공식을 그대로 사용하세요. roleTitle 이나 JD 원문에서 추정한 직무명은 focusPosition 이 아닙니다.

게이트가 열린 경우(= focusPosition 섹션이 입력에 존재)에만 아래 절차를 따르세요.

A. JD 분석 결과의 "자격 요건 (필수)" 이 "(명시 없음)" 인 경우:
  1. focusPosition 텍스트 + JD 원문 미리보기 + "주요 업무" 섹션에서 해당 포지션의 **핵심 필수 역량 3~5개** 를 선정하세요 (이하 "도출 필수 스킬").
  2. 이 도출 필수 스킬이 곧 requiredSkills 계산의 "JD 필수 스킬 수" 입니다.
     - requiredSkills.max = 도출 필수 스킬 수 × 15 (최소 3 × 15 = 45)
     - requiredSkills.earned 는 해당 스킬들의 match/partial 수로 '## 점수 산정' 공식대로 계산
  3. 도출 필수 스킬은 반드시 skillMatches 에 포함 (순서 무관, 추가 스킬 허용). skillMatches 는 최소 3개 이상.
  4. summary 첫 문장에 "focusPosition 기반 도출 역량: A, B, C" 를 명시해 사용자가 근거를 확인할 수 있게 하세요.
  5. focusPosition 섹션이 있고 requiredSkills.max == 0 인 출력은 금지입니다 (불변식 위반).

B. JD 분석 결과에 requirements 가 이미 있는 경우:
  - '## 점수 산정' 의 기본 공식을 그대로 사용. focusPosition 은 skillMatches 범위 제한(다른 포지션 요건 제외) 용도로만 쓰고, 별도 도출 절차 없음.

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
      "comment": "매칭 상세 설명 (1문장, partial/gap 이면 지원자 경력 연수 또는 대표 프로젝트명 1개 이상 언급)"
    }
  ],
  "advice": "지원 전략 조언 (2-3문장, 아래 '## 조언' 섹션의 형식을 따라 구체 스킬명·기간·행동을 명시)"
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

**experience.earned 판정 상세 (중요)**
"JD 경력 요건" 이란 최소 기준이지 상한이 아닙니다. 지원자 경력이 요건을 **초과**해도 충족으로 판정(earned=10)하고, 초과분은 오히려 강점·advice 에서 경력 활용 전략으로 다룹니다.

- JD "신입~1년 인턴" × 지원자 3년 → earned=10 (초과는 감점 사유 아님). strengths 에 "풍부한 실무 경험"을, advice 에 "경력자가 이 포지션을 선택한 동기·인턴십에서 얻을 것" 언급.
- JD "3년 이상" × 지원자 2년 → earned=5 (1년 미달이지만 근접).
- JD "3년 이상" × 지원자 0.5년 → earned=0.
- JD "경력 무관" → earned=10 (요건 없음).
- 지원자 경력 도메인이 JD 와 완전히 다른 경우(예: 프론트엔드 5년 × 백엔드 3년 요건) → earned=5, advice 에 도메인 전환 학습 로드맵.

경력 연수만 보고 "초과 = 0" 으로 처리하지 마세요. 이는 매칭 품질을 크게 떨어뜨립니다.

**불변식 (출력 전 셀프 체크)**
1. requiredSkills.earned ≤ requiredSkills.max
2. preferredSkills.earned ≤ preferredSkills.max
3. experience.earned ∈ {0, 5, 10}, experience.max == 10
4. base == 20
5. **등식:** score == min(100, requiredSkills.earned + preferredSkills.earned + experience.earned + base)

이 등식이 맞지 않으면 score를 바꾸지 말고 earned 값을 조정해 등식을 성립시키세요. skillMatches의 match/partial 수와 earned 값이 실제로 일치하도록 점검하세요.

## 조언
- 점수가 낮아도 부정적이지 않게, 성장 방향 제시
- 구체적으로 어떤 스킬을, 어떤 기간 동안, 어떤 방법으로 보완할지 조언
- **반드시 포함:** (1) 지원자 보유 스킬/경력 중 활용 가능한 자산 1개, (2) JD gap 중 우선 보완 스킬 1개 이상, (3) 구체적 학습/프로젝트 액션과 기간 (주/개월 단위).
- 추상적 권유("부족한 점을 보완하세요", "꾸준히 성장하세요") 금지.

### 조언 예시 (형식 준수 · 출력 스타일 참고용)
good (기술 직무): "React 12개월 경험이 있으니 useMemo/useCallback 심화를 2주 집중하고, Next.js App Router 샘플 프로젝트 1건으로 JD 의 SSR 요구를 보강하세요. AWS 경험은 강점이니 이력서 상단에 배치하는 것을 권장합니다."
good (비기술 직무): "마케팅 캠페인 2년 경험을 토대로 Google Analytics GA4 이벤트 설계 과제를 3주 안에 1건 완료해 JD 의 '데이터 기반 의사결정' 요건을 증명하세요. SQL 은 중급 과제 사이트에서 2주 집중 학습 권장."
bad: "부족한 스킬을 보완하세요." (기간·스킬명·자산 누락)
bad: "AI 관련 학습을 꾸준히 하시면 좋겠습니다." (구체성 부족)`;

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

  // focusPosition 브랜치에서 LLM 이 도출 필수 스킬 선언을 누락하고 max=0 으로
  // 내보낸 경우의 바닥값. skillMatches 를 이미 3개 이상 냈다면 "필수 스킬 수 ≥ 3"
  // 은 프롬프트 계약상 참이므로 max 만 floor. earned 는 LLM 값 존중.
  if (b.requiredSkills.max === 0 && result.skillMatches.length >= 3) {
    b.requiredSkills.max = 45;
  }

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
