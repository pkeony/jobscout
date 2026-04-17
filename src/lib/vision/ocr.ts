import { stream } from "@/lib/ai";
import type { AiMessage, AiUsage } from "@/lib/ai/types";
import { OCR_SYSTEM_PROMPT, buildOcrInstruction } from "@/lib/prompts/ocr";
import type { FetchedImage } from "./fetch-image";

export async function ocrImagesToText(
  apiKey: string,
  images: FetchedImage[],
  opts?: { signal?: AbortSignal },
): Promise<{ text: string; usage: AiUsage }> {
  if (images.length === 0) {
    throw new Error("[vision/ocr] 이미지가 비어있음");
  }

  const messages: AiMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: buildOcrInstruction(images.length) },
        ...images.map((img) => ({
          type: "image" as const,
          mimeType: img.mimeType,
          data: img.data,
        })),
      ],
    },
  ];

  let text = "";
  let usage: AiUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  for await (const event of stream(apiKey, messages, {
    model: "gemini-2.5-flash",
    system: OCR_SYSTEM_PROMPT,
    temperature: 0,
    maxTokens: 8192,
    signal: opts?.signal,
  })) {
    if (event.type === "delta") {
      text += event.text;
    } else if (event.type === "done") {
      usage = event.usage;
    }
  }

  return { text: text.trim(), usage };
}
