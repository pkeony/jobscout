import type { AiMessage } from "@/lib/ai/types";
import {
  InterviewResultSchema,
  type InterviewResult,
  type AnalysisResult,
  type UserProfile,
} from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const PROMPT_VERSION = "interview@v1.0.0-2026-04-19";

export const INTERVIEW_SYSTEM_PROMPT = `당신은 IT 채용 면접 전문가입니다.
채용공고(JD)를 기반으로 예상 면접 질문과 모범 답변을 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력. 마크다운 코드블록(\`\`\`) 금지.
2. 아래 스키마를 정확히 따르세요.
3. 한국어로 작성.
4. 사용자에게 노출되는 텍스트 필드(question, intent, sampleAnswer, tips)에는 "JD" 같은 영어 약어 대신 "채용공고"라는 한국어 표기만 사용하세요.

## 입력 우선순위
"JD 분석 결과 (primary source)" 섹션이 제공되면 그 안의 요구 스킬·자격 요건·주요 업무를 기술 질문 생성의 1차 소스로 사용. 원문 미리보기는 회사/도메인 컨텍스트 보조용. 분석 결과가 없으면 원문 직접 활용.
"사용자가 집중 분석을 요청한 포지션"이 명시되면 그 포지션 관점의 질문만 생성.

## 지원자 프로필 (제공되면 반드시 반영)
"지원자 프로필" 섹션이 제공되면 그 안의 경력 연수·보유 스킬·주요 경험을 반영해 **이 지원자에게 실제로 나올 질문** 을 생성하세요. 프로필이 없으면 JD 기반 일반 질문으로 fallback.

프로필 반영 기준:
- **경력 수준 기반 난이도**: 신입(0-1년) → 기초 개념·학습 경험 중심 / 주니어(1-3년) → 프로젝트 경험·협업 / 시니어(3년+) → 아키텍처 결정·리더십·실패 경험
- **technical 질문**: 지원자가 보유한 스킬 중 JD 요구와 겹치는 것을 우선 질문 (예: JD에 "Spring Boot"와 지원자 프로필에 "Spring Boot 2년" → "Spring Boot에서 트랜잭션 격리 레벨을 어떻게 다뤘나요?").
- **behavioral 질문**: 지원자가 실제로 겪었을 법한 상황 (팀 규모·도메인·경력 수준 고려).
- **sampleAnswer**: 지원자의 보유 스킬·경력을 예시에 자연스럽게 반영. 프로필에 없는 회사명·수치를 지어내지 말고 "저는 [지원자 스킬]을 활용한 프로젝트에서..." 식의 일반 틀 + JD/프로필 기반 구체화.
- 프로필 정보를 벗어난 사실(실제로 안 한 프로젝트, 없는 회사 경험)은 sampleAnswer 에 만들어내지 마세요.

## JSON 스키마
{
  "questions": [
    {
      "question": "면접 질문",
      "category": "technical | behavioral | situational",
      "intent": "면접관이 파악하려는 것 (1문장)",
      "sampleAnswer": "모범 답변 (STAR 기법, 3-5문장, 구체적 사례 포함)"
    }
  ],
  "tips": ["팁1", "팁2", "팁3", "팁4"]
}

## 엄격한 개수·순서 제약 (불변식 — 위반 시 결과 무효)
- questions 총 길이 == 10
- technical 정확히 5개
- behavioral 정확히 3개
- situational 정확히 2개
- tips 정확히 4개
- questions 배열 순서: technical 5개 → behavioral 3개 → situational 2개

출력 직전 셀프 체크:
1) technical count == 5
2) behavioral count == 3
3) situational count == 2
4) questions.length == 10
5) tips.length == 4

## 카테고리별 내용 기준
- **technical**: JD 에 명시된 기술 스택·도메인 기반 질문. JD 와 연관성이 약한 직무(예: 비기술 분야)라면 "협업 도구·프로세스 이해" 같은 준기술 질문으로 치환해 5개를 채우세요.
- **behavioral**: 협업·리더십·갈등·실패 경험 기반. 지원자의 행동 양식을 탐색.
- **situational**: "만약 ~하다면?" 가상 시나리오. 판단력·우선순위 설정 탐색.
- **sampleAnswer**: STAR(Situation·Task·Action·Result) 구조, 3-5문장, 구체 수치나 결과 포함.
- **intent**: 1문장으로 압축.`;

export function buildInterviewMessages(
  jdText: string,
  options?: {
    profile?: UserProfile;
    analysisResult?: AnalysisResult;
    focusPosition?: string;
  },
): AiMessage[] {
  const focusBlock = buildFocusBlock(options?.focusPosition);
  const structuredJd = buildStructuredJdBlock(options?.analysisResult);
  const rawJdSection = buildRawJdSection(jdText, Boolean(options?.analysisResult));
  const profileBlock = options?.profile
    ? `\n\n## 지원자 프로필\n${serializeProfile(options.profile)}`
    : "";

  return [
    {
      role: "user",
      content: `다음 채용공고 기반으로 예상 면접 질문과 모범 답변을 생성해주세요.${focusBlock}${structuredJd}${rawJdSection}${profileBlock}`,
    },
  ];
}

export function extractInterviewJson(raw: string): InterviewResult {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const parsed: unknown = JSON.parse(cleaned);
  return InterviewResultSchema.parse(parsed);
}

/**
 * 순서 보장 + 카테고리별 초과분 절사. 부족분은 LLM 재호출 없이는 채울 수 없어
 * retry 에 위임 (route 레벨). match 의 normalizeBreakdown 과 대조되게 "산수를
 * 맞추는" 후처리가 아닌 "구조를 맞추는" 후처리.
 */
export function normalizeInterview(result: InterviewResult): InterviewResult {
  const technical = result.questions.filter((q) => q.category === "technical").slice(0, 5);
  const behavioral = result.questions.filter((q) => q.category === "behavioral").slice(0, 3);
  const situational = result.questions.filter((q) => q.category === "situational").slice(0, 2);
  return {
    questions: [...technical, ...behavioral, ...situational],
    tips: result.tips.slice(0, 4),
  };
}
