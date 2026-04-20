import { MatchHistoryEntrySchema, type MatchHistoryEntry } from "@/types";
import { z } from "zod";
import { emitJobsChanged } from "./events";
import {
  pushMatchEntry,
  pushMatchDelete,
  pushMatchClear,
} from "@/lib/sync/push";

const HISTORY_KEY = "jobscout:matchHistory";
const MAX_ENTRIES = 20;

const HistoryArraySchema = z.array(MatchHistoryEntrySchema);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadHistory(): MatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return HistoryArraySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveHistory(entries: MatchHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  emitJobsChanged();
}

export function addHistoryEntry(
  entry: Omit<MatchHistoryEntry, "id" | "savedAt">,
): MatchHistoryEntry {
  const full: MatchHistoryEntry = {
    ...entry,
    id: genId(),
    savedAt: Date.now(),
  };
  const next = [full, ...loadHistory()].slice(0, MAX_ENTRIES);
  saveHistory(next);
  pushMatchEntry(full);
  return full;
}

export function deleteHistoryEntry(id: string): void {
  saveHistory(loadHistory().filter((e) => e.id !== id));
  pushMatchDelete(id);
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  emitJobsChanged();
  pushMatchClear();
}

export function getHistoryEntry(id: string): MatchHistoryEntry | null {
  return loadHistory().find((e) => e.id === id) ?? null;
}
