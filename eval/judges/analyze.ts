import type { AnalysisResult } from "@/types";
import type { AnalyzeGoldsetCase, JudgeScore } from "../types";
import { callJudge } from "./_shared";

const JUDGE_SYSTEM = `당신은 채용공고 분석 품질 평가자입니다.
AI가 생성한 분석 결과가 JD 원문과 얼마나 정확히 일치하는지 0.0~1.0 실수로 평가하세요.

## 평가 축 (4가지 체크리스트)
각 축을 pass(1) / fail(0) 로 판정하고, 합계(n/4)를 0~1 실수로 정규화해 score 로 냅니다.

1. **스킬 추출 정확성**: result.skills 에 들어있는 모든 스킬명이 JD 원문에 문자 그대로 또는 명백한 동의어로 등장하는가. 원문 근거 없이 "도메인 추론" 으로 추가된 스킬이 있으면 fail.
2. **카테고리 분류 정확성**: 자격요건 섹션의 스킬은 required, 우대사항 섹션의 스킬은 preferred 로 분류됐는가. 뒤섞였으면 fail.
3. **서술 구체성**: summary, keyResponsibilities, requirements 가 JD 원문의 핵심 정보(수치·고유명사·역할)를 담고 있는가. 지나치게 추상적이면 fail.
4. **Hallucination 여부**: expected.forbiddenDomains 가 지정돼 있다면 그 도메인(예: CV 전용 JD 인데 LLM 스킬 주입) 의 hallucination 이 없어야 pass. 그 외 원문에 없는 회사명·수치 날조도 체크.

## 출력 형식 (엄격)
JSON 한 개만. 코드블록(\`\`\`) 금지.
{"score": <0.0~1.0 실수, 0.25 단위 권장>, "rationale": "<한국어 1~2문장, 어느 축이 fail 인지>"}`;

export async function judgeAnalyze(
  case_: AnalyzeGoldsetCase,
  result: AnalysisResult,
): Promise<JudgeScore> {
  return callJudge(JUDGE_SYSTEM, buildJudgePrompt(case_, result), 512);
}

function buildJudgePrompt(
  case_: AnalyzeGoldsetCase,
  result: AnalysisResult,
): string {
  const jdPreview =
    case_.jdText.length > 2500 ? case_.jdText.slice(0, 2500) + "..." : case_.jdText;
  const focusLine = case_.focusPosition
    ? `\n## 집중 분석 대상 포지션\n"${case_.focusPosition}"\n`
    : "";
  const forbidden =
    case_.expected.forbiddenDomains.length > 0
      ? `\n## 금지 도메인 (hallucination 방어)\n다음 도메인의 스킬이 output 에 등장하면 fail: ${case_.expected.forbiddenDomains.join(", ")}\n`
      : "";
  const mustHave =
    case_.expected.mustHaveSkills.length > 0
      ? `\n## 원문에 명백히 있어야 할 required 스킬\n${case_.expected.mustHaveSkills.join(", ")}\n`
      : "";
  return `## JD 원문
${jdPreview}
${focusLine}${mustHave}${forbidden}
## 골든셋 판정 기준 (참고)
${case_.expected.judgeRubric}

## AI가 생성한 분석 결과
${JSON.stringify(result, null, 2)}

위 분석 결과를 JD 원문·금지 도메인·필수 스킬 관점에서 평가하세요. 체크리스트 4개 중 pass 개수를 n/4 로 정규화해 score 로 냅니다.`;
}
