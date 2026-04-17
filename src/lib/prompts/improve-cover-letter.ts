import type { AiMessage } from "@/lib/ai/types";

export const IMPROVE_COVER_LETTER_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서 첨삭 전문가입니다.
기존 자기소개서를 채용공고(JD)에 맞게 개선 제안을 합니다.

## 출력 규칙
1. 마크다운 형식으로 작성하세요.
2. 한국어로 작성하세요.

## 구조
1. **총평** — 현재 자소서의 강점/약점 요약 (2-3문장)
2. **수정 제안** — 섹션별로 구체적 수정 사항 (원문 인용 → 수정안)
3. **추가 제안** — JD에서 요구하지만 자소서에 빠진 내용
4. **수정된 전체 자소서** — 개선 사항을 반영한 완성본`;

export function buildImproveCoverLetterMessages(
  coverLetterText: string,
  jdText: string,
): AiMessage[] {
  return [
    {
      role: "user",
      content: `다음 자기소개서를 채용공고에 맞게 개선해주세요.

## 채용공고
${jdText}

## 기존 자기소개서
${coverLetterText}`,
    },
  ];
}
