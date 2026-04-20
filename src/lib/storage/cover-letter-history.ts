import {
  CoverLetterHistoryEntrySchema,
  type CoverLetterHistoryEntry,
} from "@/types";
import { z } from "zod";
import { emitJobsChanged } from "./events";

const HISTORY_KEY = "jobscout:coverLetterHistory";
const MAX_ENTRIES = 20;

const HistoryArraySchema = z.array(CoverLetterHistoryEntrySchema);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadCoverLetterHistory(): CoverLetterHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return HistoryArraySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveHistory(entries: CoverLetterHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  emitJobsChanged();
}

export function addCoverLetterHistoryEntry(
  entry: Omit<CoverLetterHistoryEntry, "id" | "savedAt">,
): CoverLetterHistoryEntry {
  const full: CoverLetterHistoryEntry = {
    ...entry,
    id: genId(),
    savedAt: Date.now(),
  };
  const next = [full, ...loadCoverLetterHistory()].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return full;
}

export function deleteCoverLetterHistoryEntry(id: string): void {
  saveHistory(loadCoverLetterHistory().filter((e) => e.id !== id));
}

export function clearCoverLetterHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  emitJobsChanged();
}
