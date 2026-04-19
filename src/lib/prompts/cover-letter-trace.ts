import type { AiMessage } from "@/lib/ai/types";
import {
  CoverLetterTraceResultSchema,
  type CoverLetterResult,
  type CoverLetterTraceResult,
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

export const PROMPT_VERSION = "cover-letter-trace@v1.0.0-2026-04-19";

export const COVER_LETTER_TRACE_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서·면접 진단 전문가입니다.
사용자의 자기소개서와 채용공고 기반 예상 면접 질문 10개를 함께 보고, **면접 질문이 드러내는 자기소개서의 약점**을 추출해 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력. 마크다운 코드블록(\`\`\`) 금지.
2. 아래 스키마를 정확히 따르세요.
3. 한국어로 작성.
4. 사용자에게 노출되는 텍스트 필드(summary, evidenceQuestion, evidenceIntent, suggestion, overallDiagnosis)에는 "JD" 같은 영어 약어 대신 "채용공고"라는 한국어 표기만 사용하세요.

## 약점 추출 핵심 원칙 (위반 시 결과 무효)
- **각 weakness 는 제공된 면접 질문 중 1개 이상의 질문/intent 에 명시적으로 연결**되어야 합니다. evidenceQuestion 에 그 질문 원문을, evidenceIntent 에 그 질문의 intent 를 그대로 옮겨 적으세요. 임의로 만든 질문 금지.
- **summary 는 자기소개서에 실제로 등장하는 표현·주장·경험에 한정**해서 약점을 기술하세요. 자소서에 없는 사실을 약점으로 만들면 hallucination — 출력 금지.
  - 좋은 예: "성장 경험에서 'Spring Boot 프로젝트' 라고만 언급하고 트랜잭션 격리·장애 복구 같은 깊이 있는 의사결정을 적지 않음."
  - 나쁜 예: "MSA 운영 경험이 없음" (자소서에 MSA 언급 자체가 없는데 약점으로 잡음)
- **suggestion 은 보강 방향 1~2문장.** "어떤 경험·구체 수치·결정 근거를 추가하면 좋을지" 명시. 새 사실을 만들지 말고 사용자가 이미 가졌을 만한 디테일을 끌어내는 방향.
- **relatedHeading 은 자소서 4섹션 중 하나** ("지원 동기" / "핵심 역량" / "성장 경험" / "입사 후 포부") 에 매핑 가능하면 채우고, 애매하면 비워두세요.
- **id 는 "w-1", "w-2", ... 순차 인덱스.**
- **overallDiagnosis 는 2~3문장 총평** — 자소서 전체에서 면접 대비 가장 시급한 보강 방향.

## JSON 스키마
{
  "weaknesses": [
    {
      "id": "w-1",
      "summary": "자소서의 어떤 표현/주장이 빈약한지 1문장",
      "evidenceQuestion": "이 약점을 드러내는 면접 질문 원문",
      "evidenceIntent": "그 질문의 intent (제공된 intent 그대로)",
      "suggestion": "보강 방향 1~2문장",
      "relatedHeading": "지원 동기 | 핵심 역량 | 성장 경험 | 입사 후 포부 (선택)"
    }
  ],
  "overallDiagnosis": "총평 2~3문장"
}

## 엄격한 개수 제약
- weaknesses 개수: 3개 이상 8개 이하 (필수)
- 면접 질문 10개 모두를 다룰 필요 없음. 자소서 약점이 명확히 드러나는 질문에만 매핑.

출력 직전 셀프 체크:
1) weaknesses.length 가 3 이상 8 이하인가
2) 모든 weakness.evidenceQuestion 이 제공된 questions[i].question 중 하나와 일치하는가
3) 모든 weakness.summary 가 자소서 sections[].paragraphs[] 에 등장하는 표현·주장·경험과 연결되는가 (자소서에 없는 사실을 약점으로 잡지 않았는가)
4) overallDiagnosis 가 2~3문장인가`;

function serializeCoverLetter(coverLetter: CoverLetterResult): string {
  const sections = coverLetter.sections
    .map((s) => `### ${s.heading}\n${s.paragraphs.map((p, i) => `(문단 ${i + 1}) ${p}`).join("\n")}`)
    .join("\n\n");
  return `**회사**: ${coverLetter.companyName}\n**직무**: ${coverLetter.jobTitle}\n\n${sections}`;
}

function serializeInterview(interview: InterviewResult): string {
  return interview.questions
    .map((q, i) => `(${i + 1}) [${q.category}] ${q.question}\n  intent: ${q.intent}`)
    .join("\n");
}

export function buildCoverLetterTraceMessages(
  coverLetter: CoverLetterResult,
  interview: InterviewResult,
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
      content: `다음 자기소개서와 면접 질문 10개를 보고, **면접 질문이 드러낸 자소서의 약점** 을 추출해주세요.${focusBlock}${structuredJd}${rawJdSection}${profileBlock}

## 자기소개서 v0
${serializeCoverLetter(coverLetter)}

## 채용공고 기반 예상 면접 질문 10개
${serializeInterview(interview)}`,
    },
  ];
}

export function extractCoverLetterTraceJson(raw: string): CoverLetterTraceResult {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const parsed: unknown = JSON.parse(cleaned);
  return CoverLetterTraceResultSchema.parse(parsed);
}

/**
 * id 누락·중복 방어 + relatedHeading 화이트리스트 제한.
 * LLM 이 4섹션 외 heading 을 만들면 기존 자소서 헤딩이 아니므로 drop.
 */
const ALLOWED_HEADINGS = new Set([
  "지원 동기",
  "핵심 역량",
  "성장 경험",
  "입사 후 포부",
]);

export function normalizeCoverLetterTrace(
  result: CoverLetterTraceResult,
): CoverLetterTraceResult {
  const seen = new Set<string>();
  const weaknesses = result.weaknesses.map((w, i) => {
    let id = w.id?.trim() || `w-${i + 1}`;
    if (seen.has(id)) id = `w-${i + 1}`;
    seen.add(id);
    const relatedHeading =
      w.relatedHeading && ALLOWED_HEADINGS.has(w.relatedHeading.trim())
        ? w.relatedHeading.trim()
        : undefined;
    return { ...w, id, relatedHeading };
  });
  return { ...result, weaknesses };
}
