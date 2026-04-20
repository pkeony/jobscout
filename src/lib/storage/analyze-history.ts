import { AnalyzeHistoryEntrySchema, type AnalyzeHistoryEntry } from "@/types";
import { z } from "zod";
import { emitJobsChanged } from "./events";

const HISTORY_KEY = "jobscout:analyzeHistory";
const MAX_ENTRIES = 20;

const HistoryArraySchema = z.array(AnalyzeHistoryEntrySchema);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadAnalyzeHistory(): AnalyzeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return HistoryArraySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveHistory(entries: AnalyzeHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  emitJobsChanged();
}

/**
 * 같은 jdText로 분석한 항목이 최근 5개 안에 있으면 중복으로 보고 그 항목을 갱신만 함.
 * (사용자가 같은 공고를 여러 번 열어봐도 히스토리가 똑같은 게 늘어나지 않게)
 */
export function addAnalyzeHistoryEntry(
  entry: Omit<AnalyzeHistoryEntry, "id" | "savedAt">,
): AnalyzeHistoryEntry {
  const existing = loadAnalyzeHistory();
  const dupIdx = existing
    .slice(0, 5)
    .findIndex(
      (e) =>
        e.jdText === entry.jdText &&
        (e.focusPosition ?? "") === (entry.focusPosition ?? ""),
    );

  if (dupIdx !== -1) {
    const updated: AnalyzeHistoryEntry = {
      ...existing[dupIdx],
      ...entry,
      id: existing[dupIdx].id,
      savedAt: Date.now(),
    };
    const next = [updated, ...existing.filter((_, i) => i !== dupIdx)].slice(0, MAX_ENTRIES);
    saveHistory(next);
    return updated;
  }

  const full: AnalyzeHistoryEntry = {
    ...entry,
    id: genId(),
    savedAt: Date.now(),
  };
  const next = [full, ...existing].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return full;
}

export function deleteAnalyzeHistoryEntry(id: string): void {
  saveHistory(loadAnalyzeHistory().filter((e) => e.id !== id));
}

export function clearAnalyzeHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  emitJobsChanged();
}
