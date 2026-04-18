import type { CoverLetterResult } from "@/types";
import type { CoverLetterGoldsetCase, JudgeScore } from "../types";
import { callJudge } from "./_shared";

const JUDGE_SYSTEM = `당신은 한국 IT 취업 자기소개서 품질 평가자입니다.
AI가 생성한 자소서 초안이 JD·프로필 관점에서 합당한지 0.0~1.0 실수로 평가하세요.

## 평가 축 (4가지 체크리스트)
각 축 pass(1) / fail(0) 후 n/4 로 정규화해 score.

1. **STAR 구조 명확성**: 주요 문단이 Situation → Task → Action → Result 흐름을 따르는가. "상황→과제→행동→결과" 의 서사가 드러나면 pass. 나열·추상적 기술만 있으면 fail.
2. **프로필 반영도**: 지원자 프로필의 경험·스킬·수치가 구체적으로 인용되는가. 프로필에 없는 회사명·수치·직책을 만들어냈으면 fail (hallucination).
3. **JD 스킬 연결**: JD 의 required/preferred 스킬이 핵심 역량·성장 경험 섹션에 매칭되는가. 전혀 연결되지 않으면 fail.
4. **자연스러움·톤**: 과도한 상투어·어색한 번역투 없이 자연스럽게 읽히는가. 문단 길이 균형도 고려.

## 출력 형식 (엄격)
JSON 한 개만. 코드블록(\`\`\`) 금지.
{"score": <0.0~1.0, 0.25 단위>, "rationale": "<한국어 1~2문장, 어느 축이 fail 인지>"}`;

export async function judgeCoverLetter(
  case_: CoverLetterGoldsetCase,
  result: CoverLetterResult,
): Promise<JudgeScore> {
  return callJudge(JUDGE_SYSTEM, buildJudgePrompt(case_, result), 512);
}

function buildJudgePrompt(
  case_: CoverLetterGoldsetCase,
  result: CoverLetterResult,
): string {
  const jdPreview =
    case_.jdText.length > 2000 ? case_.jdText.slice(0, 2000) + "..." : case_.jdText;
  const focusLine = case_.focusPosition
    ? `\n## 집중 분석 대상 포지션\n"${case_.focusPosition}"\n`
    : "";
  return `## JD 원문
${jdPreview}
${focusLine}
## 지원자 프로필
${JSON.stringify(case_.profile, null, 2)}

## 골든셋 판정 기준 (참고)
${case_.expected.judgeRubric}

## AI가 생성한 자소서
${JSON.stringify(result, null, 2)}

위 자소서를 4축 체크리스트로 평가하세요. pass 개수를 n/4 로 정규화해 score 로 내세요.`;
}
