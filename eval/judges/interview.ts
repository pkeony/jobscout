import type { InterviewResult } from "@/types";
import type { InterviewGoldsetCase, JudgeScore } from "../types";
import { callJudge } from "./_shared";

const JUDGE_SYSTEM = `당신은 IT 채용 면접 질문 품질 평가자입니다.
AI가 생성한 예상 면접 질문 세트가 JD·지원자 프로필에 비춰 합당한지 0.0~1.0 실수로 평가하세요.

## 평가 축 (4가지 체크리스트)
각 축 pass(1) / fail(0) 후 n/4 로 정규화해 score.

1. **질문 품질**: JD 요구 스킬·업무 기반 technical 질문이 지원자에게 실제로 나올 법한가. 뻔한 일반 질문만 나열되면 fail.
2. **프로필 난이도 적절성**: 지원자 경력 수준(신입/주니어/시니어)에 맞는 깊이인가. 신입에 아키텍처 결정을 묻거나, 시니어에 기초 개념만 묻는다면 fail.
3. **sampleAnswer hallucination**: 모범 답변에 프로필에 없는 회사명·수치·직책을 만들어내지 않았는가. 허구 경험이 있으면 fail.
4. **STAR 구조 + 꼬리 질문 여지**: sampleAnswer 가 Situation→Task→Action→Result 흐름을 따르고, 면접관이 follow-up 할 수 있는 구체성이 있는가.

## 출력 형식 (엄격)
JSON 한 개만. 코드블록(\`\`\`) 금지.
{"score": <0.0~1.0, 0.25 단위>, "rationale": "<한국어 1~2문장, 어느 축이 fail 인지>"}`;

export async function judgeInterview(
  case_: InterviewGoldsetCase,
  result: InterviewResult,
): Promise<JudgeScore> {
  return callJudge(JUDGE_SYSTEM, buildJudgePrompt(case_, result), 512);
}

function buildJudgePrompt(
  case_: InterviewGoldsetCase,
  result: InterviewResult,
): string {
  const jdPreview =
    case_.jdText.length > 1800 ? case_.jdText.slice(0, 1800) + "..." : case_.jdText;
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

## AI가 생성한 면접 질문 세트
${JSON.stringify(result, null, 2)}

위 면접 질문을 4축 체크리스트로 평가하세요. pass 개수를 n/4 로 정규화해 score 로 내세요.`;
}
