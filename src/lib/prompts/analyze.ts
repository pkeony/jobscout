import type { AiMessage } from "@/lib/ai/types";
import { AnalysisResultSchema, type AnalysisResult } from "@/types";

export const ANALYZE_SYSTEM_PROMPT = `당신은 채용공고 분석 전문가입니다.
사용자가 제공하는 채용공고(JD) 텍스트를 분석하여 구조화된 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`)으로 감싸지 마세요.
2. 아래 JSON 스키마를 정확히 따르세요.
3. 한국어로 작성하세요.

## JSON 스키마
{
  "skills": [
    {
      "name": "스킬명 (예: React, TypeScript, Python)",
      "category": "required | preferred | etc",
      "level": "beginner | intermediate | advanced | unspecified",
      "context": "JD에서 해당 스킬이 언급된 맥락 요약 (1문장)"
    }
  ],
  "summary": "채용공고 전체 요약 (3-5문장)",
  "roleTitle": "직무명 (예: 프론트엔드 개발자)",
  "experienceLevel": "경력 요건 (예: 3년 이상, 신입, 경력무관)",
  "companyInfo": {
    "name": "회사명",
    "industry": "업종 (파악 가능한 경우)",
    "size": "회사 규모 (파악 가능한 경우)",
    "culture": ["기업문화 키워드1", "키워드2"]
  },
  "keyResponsibilities": ["주요 업무1", "주요 업무2"],
  "benefits": ["복리후생1", "복리후생2"]
}

## 분석 지침
- "자격요건", "필수", "지원자격" → category: "required"
- "우대사항", "우대", "플러스" → category: "preferred"
- 기타 언급 → category: "etc"
- 경력 표현: "N년 이상", "신입", "경력무관" 등 원문 그대로 기재
- 파악할 수 없는 필드는 빈 문자열 또는 빈 배열로 두세요
- skills에서 동일 스킬이 필수/우대 모두에 나오면 "required" 우선`;

export function buildAnalyzeMessages(jdText: string): AiMessage[] {
  return [
    {
      role: "user",
      content: `다음 채용공고를 분석해주세요:\n\n${jdText}`,
    },
  ];
}

/**
 * Gemini 응답에서 JSON을 추출하고 Zod로 검증.
 * 코드블록으로 감싸져 있을 경우 자동 제거.
 */
export function extractJson(raw: string): AnalysisResult {
  let cleaned = raw.trim();

  // 마크다운 코드블록 제거
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // JSON 파싱
  const parsed: unknown = JSON.parse(cleaned);

  // Zod 검증
  return AnalysisResultSchema.parse(parsed);
}
