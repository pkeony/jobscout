import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 10_000; // LLM 토큰 비용 관리

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export type FileValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateFile(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "파일 크기는 5MB 이하여야 합니다" };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "PDF, DOCX, TXT 파일만 지원합니다" };
  }
  return { ok: true };
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  let text: string;

  switch (mimeType) {
    case "application/pdf": {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
      break;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }
    case "text/plain": {
      text = buffer.toString("utf-8");
      break;
    }
    default:
      throw new Error("지원하지 않는 파일 형식입니다");
  }

  return text.slice(0, MAX_TEXT_LENGTH);
}
