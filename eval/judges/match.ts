import type { MatchResult } from "@/types";
import type { JudgeScore, MatchGoldsetCase } from "../types";
import { callJudge } from "./_shared";

const JUDGE_SYSTEM = `당신은 채용 매칭 결과 품질 평가자입니다.
AI가 생성한 매칭 결과가 JD와 프로필 컨텍스트에 비춰 합당한지 0.0~1.0 실수로 평가하세요.

## 점수 기준
- 1.0: 모든 스킬 판정·점수·강점/갭/조언이 완벽히 합당
- 0.8: 대부분 합당, 1개 정도 사소한 이견
- 0.6: 절반 이상 합당, 2~3개 오류 또는 누락
- 0.4: 주요 판정에 오류가 눈에 띔 (예: 보유 스킬인데 gap 처리)
- 0.2: 심각한 오류 다수
- 0.0: 완전한 hallucination (결과가 JD/프로필과 동떨어짐)

## 평가 시 고려 사항
- skillMatches의 status(match/partial/gap)가 프로필 보유 스킬과 부합하는가
- score가 scoreBreakdown 구성과 일치하는가
- strengths/gaps가 실제 프로필 내용 기반인가 (hallucination 없는가)
- advice가 gap 보완에 실용적인가
- focusPosition이 주어졌으면 그 포지션에 한정된 평가인가

## 출력 형식 (엄격)
JSON 한 개만 반환. 코드블록(\`\`\`)으로 감싸지 마세요.
{"score": <0.0~1.0 실수>, "rationale": "<한국어 1~2문장, 핵심 근거>"}`;

export async function judgeMatch(
  case_: MatchGoldsetCase,
  result: MatchResult,
): Promise<JudgeScore> {
  return callJudge(JUDGE_SYSTEM, buildJudgePrompt(case_, result));
}

function buildJudgePrompt(
  case_: MatchGoldsetCase,
  result: MatchResult,
): string {
  const jdPreview =
    case_.jdText.length > 2000 ? case_.jdText.slice(0, 2000) + "..." : case_.jdText;
  const focusLine = case_.focusPosition
    ? `\n## 집중 분석 대상 포지션\n"${case_.focusPosition}"\n`
    : "";
  return `## JD
${jdPreview}
${focusLine}
## 지원자 프로필
${JSON.stringify(case_.profile, null, 2)}

## 골든셋 정답 기준 (참고)
${case_.expected.judgeRubric}

## AI가 생성한 매칭 결과
${JSON.stringify(result, null, 2)}

위 매칭 결과가 JD·프로필 관점에서 합당한지 0.0~1.0 점수와 근거를 JSON으로 반환하세요.`;
}
