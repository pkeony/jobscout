import {
  InterviewHistoryEntrySchema,
  type InterviewHistoryEntry,
} from "@/types";
import { z } from "zod";
import { emitJobsChanged } from "./events";

const HISTORY_KEY = "jobscout:interviewHistory";
const MAX_ENTRIES = 20;

const HistoryArraySchema = z.array(InterviewHistoryEntrySchema);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `i_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadInterviewHistory(): InterviewHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return HistoryArraySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveHistory(entries: InterviewHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  emitJobsChanged();
}

export function addInterviewHistoryEntry(
  entry: Omit<InterviewHistoryEntry, "id" | "savedAt">,
): InterviewHistoryEntry {
  const full: InterviewHistoryEntry = {
    ...entry,
    id: genId(),
    savedAt: Date.now(),
  };
  const next = [full, ...loadInterviewHistory()].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return full;
}

export function deleteInterviewHistoryEntry(id: string): void {
  saveHistory(loadInterviewHistory().filter((e) => e.id !== id));
}

export function clearInterviewHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  emitJobsChanged();
}
