import type { AiMessage } from "@/lib/ai/types";
import type { UserProfile } from "@/types";

export const COVER_LETTER_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서 작성 전문가입니다.
채용공고(JD)와 지원자 프로필을 기반으로 맞춤형 자기소개서 초안을 작성합니다.

## 작성 규칙
1. 마크다운 형식으로 작성하세요.
2. 한국어로 작성하세요.
3. 자연스럽고 진정성 있는 톤으로 작성하세요. AI가 쓴 느낌이 나지 않게.
4. 구체적 경험과 수치를 활용하세요 (프로필에 있는 정보 기반).
5. JD의 핵심 요구사항에 맞춰 강점을 어필하세요.
6. 부족한 부분은 학습 의지와 성장 가능성으로 보완하세요.

## 구조
1. **지원 동기** — 왜 이 회사/직무에 관심을 가졌는지
2. **핵심 역량** — JD 요구사항과 매칭되는 경험/스킬
3. **성장 경험** — 구체적 프로젝트나 문제 해결 사례
4. **입사 후 포부** — 기여 계획과 성장 방향

각 섹션은 2-3문단으로 작성하세요.`;

export function buildCoverLetterMessages(
  jdText: string,
  profile: UserProfile,
): AiMessage[] {
  const profileText = [
    `보유 스킬: ${profile.skills.join(", ")}`,
    `경력: ${profile.experience}`,
    profile.education ? `학력: ${profile.education}` : null,
    profile.introduction ? `자기소개: ${profile.introduction}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    {
      role: "user",
      content: `다음 채용공고에 맞는 자기소개서를 작성해주세요.

## 채용공고
${jdText}

## 지원자 프로필
${profileText}`,
    },
  ];
}
