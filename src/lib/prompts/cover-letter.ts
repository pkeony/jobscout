import type { AiMessage } from "@/lib/ai/types";
import type { AnalysisResult, UserProfile } from "@/types";
import {
  CoverLetterResultSchema,
  type CoverLetterResult,
  type CoverLetterSection,
} from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const PROMPT_VERSION = "cover-letter@v1.1.0-2026-04-19";

export const COVER_LETTER_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서 작성 전문가입니다.
채용공고(JD)와 지원자 프로필을 기반으로 맞춤형 자기소개서 초안을 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`)으로 감싸지 마세요.
2. 아래 JSON 스키마를 정확히 따르세요.
3. 한국어로 작성. 자연스럽고 진정성 있는 톤.
4. sections[].paragraphs 등 사용자에게 노출되는 텍스트에는 "JD" 같은 영어 약어 대신 "채용공고"라는 한국어 표기만 사용하세요.

## JSON 스키마
{
  "companyName": "회사명 (JD에서 추출, 미확인시 '회사명 미확인')",
  "jobTitle": "직무명 (focusPosition 또는 JD roleTitle)",
  "sections": [
    { "heading": "섹션 제목", "paragraphs": ["문단1", "문단2"] }
  ]
}

## 필수 섹션 (정확히 4개, 순서·heading 고정)
1. "지원 동기" — 왜 이 회사/직무에 관심을 가졌는지
2. "핵심 역량" — JD 요구사항과 매칭되는 경험/스킬
3. "성장 경험" — 구체적 프로젝트나 문제 해결 사례
4. "입사 후 포부" — 기여 계획과 성장 방향

각 섹션의 paragraphs는 2~3개 문단.

## STAR 구조 강제 (필수)
**"핵심 역량" 과 "성장 경험" 섹션의 각 paragraph 는 반드시 [Situation]/[Task]/[Action]/[Result] 라벨을 문장 단위로 섞어 쓰세요.** 4개 라벨 전부가 한 문단에 등장할 수도, 2개 문단에 걸쳐 나뉠 수도 있지만 **한 섹션 전체를 통틀어 [Situation] [Task] [Action] [Result] 4개 라벨이 모두 최소 1회는 나와야 합니다.**

예시 (핵심 역량 섹션 한 문단):
"[Situation] 월간 활성 유저 20만 규모의 커머스 백엔드를 담당했습니다. [Task] 기존 REST API 평균 응답이 450ms 로 병목이었고 이걸 200ms 이하로 낮추는 것이 과제였습니다. [Action] 요청 경로의 N+1 쿼리를 DataLoader 패턴으로 배치화하고 Redis 캐시 히트율을 72%까지 끌어올렸습니다. [Result] 평균 응답 180ms, p95 320ms 를 달성했고 DB CPU 사용률도 40% 감소했습니다."

"지원 동기" 와 "입사 후 포부" 섹션은 라벨 없이 자연스러운 서술 가능. 단 **구체 근거 (숫자·프로젝트명·기술명)** 를 최소 1회는 포함하세요.

구체적 수치/결과를 포함하되 프로필에 없는 사실(회사명·숫자·직책 등)은 만들어내지 마세요.

## 입력 우선순위
"JD 분석 결과 (primary source)" 섹션이 제공되면 거기 적힌 직무·요구사항·주요 업무를 자기소개서의 핵심 매칭 포인트로 사용. 원문 미리보기는 회사/문화 정보 보조용.
"사용자가 집중 분석을 요청한 포지션"이 명시되면 그 포지션 관점으로 작성.

## 예시 (참고용 — 형식·톤 파악 목적)
예시 1) 백엔드 엔지니어
{
  "companyName": "토스",
  "jobTitle": "백엔드 엔지니어",
  "sections": [
    {
      "heading": "지원 동기",
      "paragraphs": [
        "학부 시절 모바일 송금 UX에 대한 리서치 과제를 수행하며 토스 제품을 깊이 분석한 경험이 있습니다. 실시간 이체 뒤의 인프라 설계가 궁금해졌고, 금융 도메인의 제약 아래에서 대규모 트래픽을 다루는 팀에 합류하고 싶다는 생각이 확고해졌습니다."
      ]
    }
  ]
}

예시 2) AI 엔지니어
{
  "companyName": "쿠팡",
  "jobTitle": "AI 엔지니어",
  "sections": [
    {
      "heading": "성장 경험",
      "paragraphs": [
        "팀 프로젝트에서 상품 검색 랭킹 개선을 맡았고(Situation), 기존 BM25 기반 결과가 long-tail 쿼리에서 실패하는 문제가 있었습니다(Task). 임베딩 기반 재랭킹을 Python FastAPI로 제공하고 MRR 지표를 A/B로 측정(Action), 최종적으로 long-tail 쿼리의 MRR을 0.32에서 0.47로 약 47% 끌어올렸습니다(Result)."
      ]
    }
  ]
}`;

export const COVER_LETTER_CRITIQUE_SYSTEM_PROMPT = `당신은 위에서 생성된 자기소개서 JSON 초안의 편집자입니다.
초안을 아래 기준으로 다듬어 동일한 JSON 스키마로 재출력하세요.

## 개선 포인트
1. 프로필에 없는 사실(회사명·수치·직책) 허구 발견 시 프로필 기반으로 수정
2. JD의 구체 요구사항(스킬·업무)과 연결 고리가 약한 문단 강화
3. STAR 구조가 모호한 문단을 S→T→A→R 순서가 명확하도록 재작성
4. 문단 길이 균형: 지나치게 짧은 paragraphs 보완, 불필요한 반복 제거
5. 헤딩 4개(지원 동기 / 핵심 역량 / 성장 경험 / 입사 후 포부)와 순서 유지

## 출력 규칙
- 동일 JSON 스키마 (companyName, jobTitle, sections[].heading, sections[].paragraphs)
- 마크다운 코드블록 금지
- 한국어`;

export function buildCoverLetterMessages(
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
      content: `다음 채용공고에 맞는 자기소개서를 JSON으로 작성해주세요.${focusBlock}${structuredJd}${rawJdSection}

## 지원자 프로필
${profileText}`,
    },
  ];
}

export function buildCoverLetterCritiqueMessages(
  draft: CoverLetterResult,
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
      content: `## 초안 JSON
${JSON.stringify(draft, null, 2)}

## 채용공고 컨텍스트${focusBlock}${structuredJd}${rawJdSection}

## 지원자 프로필
${profileText}

위 기준에 맞춰 개선된 자기소개서 JSON을 반환해주세요.`,
    },
  ];
}

export function extractCoverLetterJson(raw: string): CoverLetterResult {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const parsed: unknown = JSON.parse(cleaned);
  return CoverLetterResultSchema.parse(parsed);
}

const REQUIRED_HEADINGS = ["지원 동기", "핵심 역량", "성장 경험", "입사 후 포부"] as const;

// heading 을 4개 고정으로 스냅·정렬. LLM 이 "1. 지원 동기" 같이 번호·공백 차이를
// 낼 수 있어 substring 매칭까지 허용. 추가 섹션은 뒤에 최대 2개만 유지.
export function normalizeCoverLetter(result: CoverLetterResult): CoverLetterResult {
  const byHeading = new Map<string, CoverLetterSection>();
  for (const section of result.sections) {
    const exact = REQUIRED_HEADINGS.find((r) => section.heading === r);
    const fuzzy = exact ?? REQUIRED_HEADINGS.find((r) => section.heading.includes(r));
    const key = fuzzy ?? section.heading;
    if (!byHeading.has(key)) {
      byHeading.set(key, { ...section, heading: fuzzy ?? section.heading });
    }
  }

  const ordered: CoverLetterSection[] = [];
  for (const required of REQUIRED_HEADINGS) {
    const hit = byHeading.get(required);
    if (hit) ordered.push(hit);
  }

  const extras = result.sections
    .filter((s) => !REQUIRED_HEADINGS.some((r) => s.heading === r || s.heading.includes(r)))
    .slice(0, 2);

  return {
    ...result,
    sections: [...ordered, ...extras],
  };
}
