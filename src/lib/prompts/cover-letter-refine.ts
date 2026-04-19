import type { AiMessage } from "@/lib/ai/types";
import {
  CoverLetterRefineResultSchema,
  type CoverLetterResult,
  type CoverLetterRefineResult,
  type CoverLetterWeakness,
  type AnalysisResult,
  type UserProfile,
} from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const PROMPT_VERSION = "cover-letter-refine@v1.1.0-2026-04-19";

export const COVER_LETTER_REFINE_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서 첨삭 전문가입니다.
기존 자기소개서(v0)와 면접 질문이 드러낸 약점 리스트를 받아, 약점을 보강한 v1 을 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력. 마크다운 코드블록(\`\`\`) 금지.
2. 아래 스키마를 정확히 따르세요.
3. 한국어로 작성.
4. 사용자에게 노출되는 텍스트 필드(revised.sections, changeNotes[].heading/before/after)에는 "JD" 같은 영어 약어 대신 "채용공고"라는 한국어 표기만 사용하세요.

## revised 작성 규칙 (4섹션 고정 — 위반 시 결과 무효)
- sections 는 정확히 4개, 순서·heading 고정: "지원 동기", "핵심 역량", "성장 경험", "입사 후 포부"
- 각 paragraphs 는 2~3개 문단
- 원문 v0 의 사실을 왜곡하지 말고, 약점을 보강하는 방향으로만 편집
- 약점 보강 시 원문 강점은 유지 (불필요한 삭제 금지)
- 지원자가 실제 하지 않은 경험은 만들어내지 마세요. 채용공고에 있는 내용이라도 v0 에 없으면 "관련 학습/관심" 수준까지만.
- **v0 의 형식·라벨·구조를 그대로 유지하세요.** 특히 v0 의 "핵심 역량" 또는 "성장 경험" 섹션 본문에 **[Situation] / [Task] / [Action] / [Result]** STAR 라벨이 박혀 있으면, v1 에서도 같은 라벨을 같은 위치에 그대로 유지하면서 라벨 안의 내용만 약점에 따라 보강하세요. 라벨을 떼고 매끄러운 산문으로 다시 쓰지 마세요. v0 에 라벨이 없는 섹션은 라벨을 새로 추가하지도 마세요.

## changeNotes 작성 규칙
- 각 약점(weaknessId) 에 대해 v1 에서 어떤 섹션의 어떤 표현을 어떻게 보강했는지 1개 이상 기록.
- heading: 보강한 섹션 heading (4섹션 중 하나)
- before: v0 의 해당 표현 인용 (1문장, 자소서에 실제 등장하는 텍스트)
- after: v1 의 보강된 표현 인용 (1~2문장)
- weaknessId: 입력으로 받은 weakness.id 그대로
- appliedWeaknessIds: 실제로 v1 에 반영한 weakness.id 목록 (changeNotes 에 등장하는 weaknessId 의 합집합과 일치)

## JSON 스키마
{
  "revised": {
    "companyName": "...",
    "jobTitle": "...",
    "sections": [
      { "heading": "지원 동기", "paragraphs": ["...", "..."] },
      { "heading": "핵심 역량", "paragraphs": ["...", "..."] },
      { "heading": "성장 경험", "paragraphs": ["...", "..."] },
      { "heading": "입사 후 포부", "paragraphs": ["...", "..."] }
    ]
  },
  "appliedWeaknessIds": ["w-1", "w-3", ...],
  "changeNotes": [
    {
      "heading": "성장 경험",
      "before": "v0 의 원문 표현 1문장",
      "after": "v1 의 보강된 표현 1~2문장",
      "weaknessId": "w-1"
    }
  ]
}

## 입력 우선순위
"JD 분석 결과 (primary source)" 섹션이 제공되면 거기 적힌 직무·요구사항을 보강의 핵심 기준으로 사용. 원문 미리보기는 회사/문화 정보 보조용.
"사용자가 집중 분석을 요청한 포지션" 이 명시되면 그 포지션 관점으로 보강.

출력 직전 셀프 체크:
1) revised.sections.length == 4
2) revised.sections[i].heading 가 정확히 ["지원 동기", "핵심 역량", "성장 경험", "입사 후 포부"] 순서
3) 각 sections[i].paragraphs.length 가 2 이상 3 이하
4) appliedWeaknessIds 가 입력으로 받은 weaknesses[].id 의 부분집합
5) changeNotes 의 weaknessId 가 모두 appliedWeaknessIds 에 포함
6) changeNotes[i].before 가 v0 자소서 텍스트에 실제로 등장하는 표현인가
7) v1 에 v0 가 한 적 없는 경험·수치를 만들어내지 않았는가`;

function serializeCoverLetter(coverLetter: CoverLetterResult): string {
  const sections = coverLetter.sections
    .map((s) => `### ${s.heading}\n${s.paragraphs.map((p, i) => `(문단 ${i + 1}) ${p}`).join("\n")}`)
    .join("\n\n");
  return `**회사**: ${coverLetter.companyName}\n**직무**: ${coverLetter.jobTitle}\n\n${sections}`;
}

function serializeWeaknesses(weaknesses: CoverLetterWeakness[]): string {
  return weaknesses
    .map(
      (w) =>
        `- [${w.id}] ${w.summary}\n  근거 면접 질문: "${w.evidenceQuestion}" (intent: ${w.evidenceIntent})\n  보강 방향: ${w.suggestion}${w.relatedHeading ? `\n  관련 섹션: ${w.relatedHeading}` : ""}`,
    )
    .join("\n");
}

export function buildCoverLetterRefineMessages(
  coverLetter: CoverLetterResult,
  weaknesses: CoverLetterWeakness[],
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
      content: `다음 자기소개서 v0 와 약점 리스트를 받아, 약점을 보강한 v1 을 생성해주세요.${focusBlock}${structuredJd}${rawJdSection}${profileBlock}

## 자기소개서 v0
${serializeCoverLetter(coverLetter)}

## 보강해야 할 약점 (선택된 항목만)
${serializeWeaknesses(weaknesses)}`,
    },
  ];
}

export function extractCoverLetterRefineJson(raw: string): CoverLetterRefineResult {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const parsed: unknown = JSON.parse(cleaned);
  return CoverLetterRefineResultSchema.parse(parsed);
}

const REQUIRED_HEADINGS = ["지원 동기", "핵심 역량", "성장 경험", "입사 후 포부"] as const;

/**
 * 4섹션 고정 강제 + appliedWeaknessIds 와 changeNotes weaknessId 정합성 보정.
 * LLM 이 heading 누락·순서 뒤섞기 시 fallback heading 으로 채움.
 */
export function normalizeCoverLetterRefine(
  result: CoverLetterRefineResult,
  inputWeaknessIds: string[],
): CoverLetterRefineResult {
  const sectionByHeading = new Map(
    result.revised.sections.map((s) => [s.heading.trim(), s]),
  );
  const fixedSections = REQUIRED_HEADINGS.map((heading) => {
    const found = sectionByHeading.get(heading);
    if (found) return { ...found, heading };
    const fallbackParagraphs =
      result.revised.sections[0]?.paragraphs.slice(0, 2) ?? [
        "(섹션 누락으로 자동 생성된 자리표시자입니다.)",
      ];
    return { heading, paragraphs: fallbackParagraphs };
  });

  const validIds = new Set(inputWeaknessIds);
  const validNotes = result.changeNotes.filter((n) => validIds.has(n.weaknessId));
  const appliedSet = new Set(
    result.appliedWeaknessIds.filter((id) => validIds.has(id)),
  );
  validNotes.forEach((n) => appliedSet.add(n.weaknessId));

  return {
    revised: {
      companyName: result.revised.companyName,
      jobTitle: result.revised.jobTitle,
      sections: fixedSections,
    },
    appliedWeaknessIds: [...appliedSet],
    changeNotes: validNotes,
  };
}
