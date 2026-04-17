import type { AiMessage } from "@/lib/ai/types";

const RESUME_PARSE_SYSTEM_PROMPT = `당신은 이력서/CV 분석 전문가입니다.
주어진 이력서 텍스트에서 지원자 프로필 정보를 추출하여 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록으로 감싸지 마세요.
2. 한국어로 작성하세요. 스킬명은 원어 그대로 유지.
3. 아래 JSON 스키마를 정확히 따르세요.

## JSON 스키마
{
  "skills": ["React", "TypeScript", ...],
  "experience": "경력 요약 (회사명, 직무, 기간 포함)",
  "education": "최종 학력 (없으면 null)",
  "introduction": "핵심 역량 요약 1-2문장 (없으면 null)"
}

## 추출 기준
- skills: 프로그래밍 언어, 프레임워크, 도구, 플랫폼 등 기술 스킬만
- experience: 가장 최근 경력부터, 회사명/직무/기간을 자연어로 요약
- education: 최종 학력만 간결하게
- introduction: 이력서의 요약/objective 섹션이 있으면 활용, 없으면 경력 기반 1줄 요약`;

export { RESUME_PARSE_SYSTEM_PROMPT };

export function buildResumeParseMessages(resumeText: string): AiMessage[] {
  return [
    {
      role: "user",
      content: `다음 이력서에서 프로필 정보를 추출해주세요.\n\n${resumeText}`,
    },
  ];
}

export function extractResumeJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)```/, "$1").trim();
  return JSON.parse(cleaned);
}
