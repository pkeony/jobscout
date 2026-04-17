import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** AI API 에러 메시지를 사용자 친화적으로 변환 */
export function friendlyError(raw: string | null): string {
  if (!raw) return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  if (raw.includes("503"))
    return "AI 서버가 현재 사용량이 많아 일시적으로 응답하지 못하고 있습니다. 보통 몇 분 안에 해소됩니다.";
  if (raw.includes("429"))
    return "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
  if (raw.includes("401") || raw.includes("403"))
    return "API 인증에 실패했습니다. API Key 설정을 확인해주세요.";
  if (raw.includes("timeout") || raw.includes("TIMEOUT"))
    return "응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.";
  return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
