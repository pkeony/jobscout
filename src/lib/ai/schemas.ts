/**
 * Gemini SDK `responseSchema` 로 전달되는 OpenAPI 3.0 서브셋 스키마.
 *
 * - Zod 도메인 스키마(src/types/index.ts)와 1:1 대응. SDK 가 1차로 포맷을 강제,
 *   런타임 Zod 파싱이 최종 방어선.
 * - 주의: Gemini 는 `minItems`/`maxItems` 를 **문자열** 값으로 받는다.
 *   (SDK 타입: `string`). "10" 같이 적어야 함.
 * - SDK 타입 의존을 프롬프트·도메인 레이어에서 끊기 위해 이 파일은 `src/lib/ai/` 에 둠.
 */

const COVER_LETTER_SECTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    heading: { type: "STRING" },
    paragraphs: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: "1",
    },
  },
  required: ["heading", "paragraphs"],
};

const COVER_LETTER_RESULT_SCHEMA_INNER = {
  type: "OBJECT",
  properties: {
    companyName: { type: "STRING" },
    jobTitle: { type: "STRING" },
    sections: {
      type: "ARRAY",
      items: COVER_LETTER_SECTION_SCHEMA,
      minItems: "3",
      maxItems: "6",
    },
  },
  required: ["companyName", "jobTitle", "sections"],
};

export const COVER_LETTER_RESPONSE_SCHEMA: unknown = COVER_LETTER_RESULT_SCHEMA_INNER;

export const IMPROVE_COVER_LETTER_RESPONSE_SCHEMA: unknown = {
  type: "OBJECT",
  properties: {
    overallComment: { type: "STRING" },
    suggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          original: { type: "STRING" },
          revised: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["heading", "original", "revised", "reason"],
      },
      minItems: "1",
    },
    missingFromJd: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    revised: COVER_LETTER_RESULT_SCHEMA_INNER,
  },
  required: ["overallComment", "suggestions", "missingFromJd", "revised"],
};

export const INTERVIEW_RESPONSE_SCHEMA: unknown = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          category: {
            type: "STRING",
            enum: ["technical", "behavioral", "situational"],
          },
          intent: { type: "STRING" },
          sampleAnswer: { type: "STRING" },
        },
        required: ["question", "category", "intent", "sampleAnswer"],
      },
      minItems: "10",
      maxItems: "10",
    },
    tips: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: "4",
      maxItems: "4",
    },
  },
  required: ["questions", "tips"],
};

const COVER_LETTER_WEAKNESS_SCHEMA = {
  type: "OBJECT",
  properties: {
    id: { type: "STRING" },
    summary: { type: "STRING" },
    evidenceQuestion: { type: "STRING" },
    evidenceIntent: { type: "STRING" },
    suggestion: { type: "STRING" },
    relatedHeading: { type: "STRING" },
  },
  required: ["id", "summary", "evidenceQuestion", "evidenceIntent", "suggestion"],
};

export const COVER_LETTER_TRACE_RESPONSE_SCHEMA: unknown = {
  type: "OBJECT",
  properties: {
    weaknesses: {
      type: "ARRAY",
      items: COVER_LETTER_WEAKNESS_SCHEMA,
      minItems: "3",
      maxItems: "8",
    },
    overallDiagnosis: { type: "STRING" },
  },
  required: ["weaknesses", "overallDiagnosis"],
};

export const COVER_LETTER_REFINE_RESPONSE_SCHEMA: unknown = {
  type: "OBJECT",
  properties: {
    revised: COVER_LETTER_RESULT_SCHEMA_INNER,
    appliedWeaknessIds: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    changeNotes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          before: { type: "STRING" },
          after: { type: "STRING" },
          weaknessId: { type: "STRING" },
        },
        required: ["heading", "before", "after", "weaknessId"],
      },
    },
  },
  required: ["revised", "appliedWeaknessIds", "changeNotes"],
};
