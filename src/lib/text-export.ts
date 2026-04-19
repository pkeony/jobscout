import type { InterviewResult, MatchResult } from "@/types";

function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export function downloadAsTxt(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const CATEGORY_LABEL: Record<InterviewResult["questions"][number]["category"], string> = {
  technical: "기술",
  behavioral: "인성",
  situational: "상황",
};

export function flattenInterviewToText(
  r: InterviewResult,
  meta?: { company?: string; jobTitle?: string },
): string {
  const header =
    meta?.company || meta?.jobTitle
      ? `${meta.company ?? ""}${meta.company && meta.jobTitle ? " · " : ""}${meta.jobTitle ?? ""}`
      : "면접 예상 질문";
  const lines: string[] = [header, "면접 예상 질문 10개", ""];
  r.questions.forEach((q, i) => {
    lines.push(`## Q${String(i + 1).padStart(2, "0")} [${CATEGORY_LABEL[q.category]}] ${q.question}`);
    lines.push(`intent: ${q.intent}`);
    lines.push("");
    lines.push("[모범 답변]");
    lines.push(q.sampleAnswer);
    lines.push("");
  });
  if (r.tips.length > 0) {
    lines.push("## 면접 팁");
    r.tips.forEach((t) => lines.push(`- ${t}`));
  }
  return lines.join("\n").trim();
}

const SKILL_STATUS_LABEL: Record<MatchResult["skillMatches"][number]["status"], string> = {
  match: "보유",
  partial: "부분",
  gap: "부족",
};

export function flattenMatchToText(
  r: MatchResult,
  meta?: { company?: string; jobTitle?: string },
): string {
  const header =
    meta?.company || meta?.jobTitle
      ? `${meta.company ?? ""}${meta.company && meta.jobTitle ? " · " : ""}${meta.jobTitle ?? ""}`
      : "프로필 매칭 결과";
  const lines: string[] = [header, "프로필 매칭 결과", ""];
  lines.push(`매칭 점수: ${r.score} / 100`);
  if (r.scoreBreakdown) {
    const b = r.scoreBreakdown;
    lines.push(
      `점수 분해: 필수 스킬 ${b.requiredSkills.earned}/${b.requiredSkills.max} · 우대 ${b.preferredSkills.earned}/${b.preferredSkills.max} · 경력 ${b.experience.earned}/${b.experience.max} · base ${b.base}`,
    );
  }
  lines.push("");
  lines.push("## 종합");
  lines.push(r.summary);
  lines.push("");
  if (r.strengths.length > 0) {
    lines.push("## 강점");
    r.strengths.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }
  if (r.gaps.length > 0) {
    lines.push("## 갭");
    r.gaps.forEach((g) => lines.push(`- ${g}`));
    lines.push("");
  }
  if (r.skillMatches.length > 0) {
    lines.push("## 스킬 매칭");
    r.skillMatches.forEach((s) =>
      lines.push(`- ${s.name} [${SKILL_STATUS_LABEL[s.status]}] — ${s.comment}`),
    );
    lines.push("");
  }
  lines.push("## 조언");
  lines.push(r.advice);
  return lines.join("\n").trim();
}

function metaSlug(meta?: { company?: string; jobTitle?: string }): string {
  const parts = [meta?.company, meta?.jobTitle].filter(Boolean) as string[];
  if (parts.length === 0) return new Date().toISOString().slice(0, 10);
  return parts.map(sanitizeFilename).join("-");
}

export function downloadInterviewAsTxt(
  r: InterviewResult,
  meta?: { company?: string; jobTitle?: string },
): void {
  downloadAsTxt(flattenInterviewToText(r, meta), `면접질문-${metaSlug(meta)}.txt`);
}

export function downloadMatchAsTxt(
  r: MatchResult,
  meta?: { company?: string; jobTitle?: string },
): void {
  downloadAsTxt(flattenMatchToText(r, meta), `매칭결과-${metaSlug(meta)}.txt`);
}
