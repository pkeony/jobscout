import type { CoverLetterResult } from "@/types";

export function flattenCoverLetterToText(r: CoverLetterResult): string {
  return [
    `${r.companyName} · ${r.jobTitle}`,
    "",
    ...r.sections.flatMap((s) => [`## ${s.heading}`, "", ...s.paragraphs, ""]),
  ]
    .join("\n")
    .trim();
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export function downloadCoverLetterAsTxt(
  result: CoverLetterResult,
  variantLabel: string,
): void {
  const text = flattenCoverLetterToText(result);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `자소서-${sanitizeFilename(result.companyName)}-${sanitizeFilename(result.jobTitle)}-${variantLabel}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
