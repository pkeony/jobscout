import type { AiMessage } from "@/lib/ai/types";
import type { AnalysisResult, UserProfile } from "@/types";
import {
  buildFocusBlock,
  buildRawJdSection,
  buildStructuredJdBlock,
  serializeProfile,
} from "./_shared";

export const COVER_LETTER_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서 작성 전문가입니다.
채용공고(JD)와 지원자 프로필을 기반으로 맞춤형 자기소개서 초안을 작성합니다.

## 작성 규칙
1. 마크다운 형식으로 작성하세요.
2. 한국어로 작성하세요.
3. 자연스럽고 진정성 있는 톤으로 작성하세요. AI가 쓴 느낌이 나지 않게.
4. 구체적 경험과 수치를 활용하세요 (프로필에 있는 정보 기반).
5. JD의 핵심 요구사항에 맞춰 강점을 어필하세요.
6. 부족한 부분은 학습 의지와 성장 가능성으로 보완하세요.

## 입력 우선순위
"JD 분석 결과 (primary source)" 섹션이 제공되면 거기 적힌 직무·요구사항·주요 업무를 자기소개서의 핵심 매칭 포인트로 활용하세요. 원문 미리보기는 회사/문화 정보 보조용으로만 참고. 분석 결과가 없으면 채용공고 원문을 직접 활용.

"사용자가 집중 분석을 요청한 포지션"이 명시되면 그 포지션에 한정된 자기소개서를 작성하세요.

## 구조
1. **지원 동기** — 왜 이 회사/직무에 관심을 가졌는지
2. **핵심 역량** — JD 요구사항과 매칭되는 경험/스킬
3. **성장 경험** — 구체적 프로젝트나 문제 해결 사례
4. **입사 후 포부** — 기여 계획과 성장 방향

각 섹션은 2-3문단으로 작성하세요.`;

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
      content: `다음 채용공고에 맞는 자기소개서를 작성해주세요.${focusBlock}${structuredJd}${rawJdSection}

## 지원자 프로필
${profileText}`,
    },
  ];
}
