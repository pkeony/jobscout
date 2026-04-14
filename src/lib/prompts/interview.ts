import type { AiMessage } from "@/lib/ai/types";
import { InterviewResultSchema, type InterviewResult } from "@/types";

export const INTERVIEW_SYSTEM_PROMPT = `당신은 IT 채용 면접 전문가입니다.
채용공고(JD)를 기반으로 예상 면접 질문과 모범 답변을 JSON으로 반환합니다.

## 출력 규칙
1. 반드시 유효한 JSON만 출력하세요. 마크다운 코드블록(\`\`\`)으로 감싸지 마세요.
2. 아래 JSON 스키마를 정확히 따르세요.
3. 한국어로 작성하세요.

## JSON 스키마
{
  "questions": [
    {
      "question": "면접 질문",
      "category": "technical | behavioral | situational",
      "intent": "면접관이 이 질문으로 파악하려는 것 (1문장)",
      "sampleAnswer": "모범 답변 (3-5문장, 구체적 사례 포함)"
    }
  ],
  "tips": ["면접 팁1", "면접 팁2"]
}

## 질문 생성 기준
- **technical** (5-7개): JD에 명시된 기술 스택 기반 기술 질문
- **behavioral** (3-4개): 협업, 리더십, 갈등 해결 등 행동 질문
- **situational** (2-3개): "만약 ~하다면?" 상황 판단 질문
- 총 10-14개 질문 생성
- 모범 답변은 STAR 기법(Situation-Task-Action-Result) 활용`;

export function buildInterviewMessages(jdText: string): AiMessage[] {
  return [
    {
      role: "user",
      content: `다음 채용공고 기반으로 예상 면접 질문과 모범 답변을 생성해주세요.

## 채용공고
${jdText}`,
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
