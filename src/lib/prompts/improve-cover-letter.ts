import type { AiMessage } from "@/lib/ai/types";
import {
  ImproveCoverLetterResultSchema,
  type ImproveCoverLetterResult,
} from "@/types";

export const PROMPT_VERSION = "improve-cover-letter@v1.0.0-2026-04-19";

export const IMPROVE_COVER_LETTER_SYSTEM_PROMPT = `당신은 한국 IT 업계 자기소개서 첨삭 전문가입니다.
기존 자기소개서를 채용공고(JD)에 맞게 개선하고 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력. 마크다운 코드블록(\`\`\`) 금지.
2. 아래 스키마를 정확히 따르세요.
3. 한국어로 작성.
4. 사용자에게 노출되는 텍스트 필드(overallComment, suggestions[].original/revised/reason, missingFromJd[], revised.sections)에는 "JD" 같은 영어 약어 대신 "채용공고"라는 한국어 표기만 사용하세요. 필드명 missingFromJd 자체는 스키마 키이므로 유지하되, 그 안 값에는 채용공고 명칭만 사용.

## JSON 스키마
{
  "overallComment": "총평 (2-3문장, 강점·약점 요약)",
  "suggestions": [
    {
      "heading": "해당 섹션 제목",
      "original": "원문 인용 (1-2문장)",
      "revised": "수정안",
      "reason": "고치는 이유 (1문장)"
    }
  ],
  "missingFromJd": ["JD에 있는데 자소서엔 빠진 요소들"],
  "revised": {
    "companyName": "...",
    "jobTitle": "...",
    "sections": [
      { "heading": "...", "paragraphs": ["..."] }
    ]
  }
}

## revised 작성 규칙
- sections 는 정확히 4개, 순서·heading 고정: "지원 동기", "핵심 역량", "성장 경험", "입사 후 포부"
- 각 paragraphs 는 2~3개 문단
- 원문의 사실을 왜곡하지 말고, JD와의 연결 고리를 강화하는 방향으로 편집
- JD에 있는 내용이라도 지원자가 실제 하지 않은 경험은 만들어내지 마세요`;

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

export function extractImproveCoverLetterJson(raw: string): ImproveCoverLetterResult {
  let cleaned = raw.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const parsed: unknown = JSON.parse(cleaned);
  return ImproveCoverLetterResultSchema.parse(parsed);
}
