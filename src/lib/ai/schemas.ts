/**
 * Gemini SDK `responseSchema`로 전달되는 OpenAPI 3.0 서브셋 스키마.
 * - SDK 타입 의존을 도메인·프롬프트 레이어에서 끊기 위해 `src/lib/ai/` 아래에 둠.
 * - 주의: Gemini는 `minItems`/`maxItems`를 **문자열** 값으로 받는다 (`"10"` not 10).
 * - Zod 스키마와 1:1 대응 관계는 runtime Zod 파싱이 최종 방어선으로 유효.
 *
 * 실제 스키마 정의는 C2(도메인 Zod 전환)와 함께 작성. 지금은 타입 placeholder.
 */

export const COVER_LETTER_RESPONSE_SCHEMA: unknown = null;
export const IMPROVE_COVER_LETTER_RESPONSE_SCHEMA: unknown = null;
export const INTERVIEW_RESPONSE_SCHEMA: unknown = null;
