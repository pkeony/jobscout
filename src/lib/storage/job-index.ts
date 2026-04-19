import type {
  AnalyzeHistoryEntry,
  CoverLetterHistoryEntry,
  InterviewHistoryEntry,
  JobStatus,
  MatchHistoryEntry,
} from "@/types";
import { loadAnalyzeHistory } from "./analyze-history";
import { loadCoverLetterHistory } from "./cover-letter-history";
import { loadInterviewHistory } from "./interview-history";
import { loadJobMeta } from "./job-meta";
import { loadHistory as loadMatchHistory } from "./match-history";

export interface Job {
  id: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
  jobUrl?: string;
  focusPosition?: string;
  hasAnalyze: boolean;
  hasMatch: boolean;
  hasCoverLetter: boolean;
  hasInterview: boolean;
  progress: 0 | 1 | 2 | 3 | 4;
  lastActivityAt: number;
  latestAnalyze?: AnalyzeHistoryEntry;
  latestMatch?: MatchHistoryEntry;
  latestCoverLetter?: CoverLetterHistoryEntry;
  latestInterview?: InterviewHistoryEntry;
  status: JobStatus;
  notes: string;
  deadline?: string;
}

/** djb2 32-bit → 8자 hex. URL 안전, 결정적, 80 entries 에서 충돌 < 1e-6. */
export function hashJdText(jdText: string): string {
  let h = 5381;
  for (let i = 0; i < jdText.length; i++) {
    h = ((h << 5) + h + jdText.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

interface Accumulator {
  id: string;
  jdText: string;
  jobTitle: string;
  companyName: string;
  jobUrl?: string;
  focusPosition?: string;
  latestAnalyze?: AnalyzeHistoryEntry;
  latestMatch?: MatchHistoryEntry;
  latestCoverLetter?: CoverLetterHistoryEntry;
  latestInterview?: InterviewHistoryEntry;
  metaSavedAt: number;
}

interface MetaCarrier {
  jobTitle: string;
  companyName: string;
  jobUrl?: string;
  focusPosition?: string;
  savedAt: number;
}

function ensureAcc(
  map: Map<string, Accumulator>,
  jdText: string,
  carrier: MetaCarrier,
): Accumulator {
  const id = hashJdText(jdText);
  const existing = map.get(id);
  if (existing) {
    if (carrier.savedAt > existing.metaSavedAt) {
      existing.jobTitle = carrier.jobTitle;
      existing.companyName = carrier.companyName;
      existing.jobUrl = carrier.jobUrl;
      existing.focusPosition = carrier.focusPosition;
      existing.metaSavedAt = carrier.savedAt;
    }
    return existing;
  }
  const created: Accumulator = {
    id,
    jdText,
    jobTitle: carrier.jobTitle,
    companyName: carrier.companyName,
    jobUrl: carrier.jobUrl,
    focusPosition: carrier.focusPosition,
    metaSavedAt: carrier.savedAt,
  };
  map.set(id, created);
  return created;
}

function finalize(acc: Accumulator): Job {
  const hasAnalyze = !!acc.latestAnalyze;
  const hasMatch = !!acc.latestMatch;
  const hasCoverLetter = !!acc.latestCoverLetter;
  const hasInterview = !!acc.latestInterview;
  const progress = ((hasAnalyze ? 1 : 0) +
    (hasMatch ? 1 : 0) +
    (hasCoverLetter ? 1 : 0) +
    (hasInterview ? 1 : 0)) as 0 | 1 | 2 | 3 | 4;
  const lastActivityAt = Math.max(
    acc.latestAnalyze?.savedAt ?? 0,
    acc.latestMatch?.savedAt ?? 0,
    acc.latestCoverLetter?.savedAt ?? 0,
    acc.latestInterview?.savedAt ?? 0,
  );
  const meta = loadJobMeta(acc.id);
  return {
    id: acc.id,
    jdText: acc.jdText,
    jobTitle: acc.jobTitle,
    companyName: acc.companyName,
    jobUrl: acc.jobUrl,
    focusPosition: acc.focusPosition,
    hasAnalyze,
    hasMatch,
    hasCoverLetter,
    hasInterview,
    progress,
    lastActivityAt,
    latestAnalyze: acc.latestAnalyze,
    latestMatch: acc.latestMatch,
    latestCoverLetter: acc.latestCoverLetter,
    latestInterview: acc.latestInterview,
    status: meta.status,
    notes: meta.notes,
    deadline: meta.deadline,
  };
}

export function buildJobIndex(): Job[] {
  if (typeof window === "undefined") return [];

  const map = new Map<string, Accumulator>();

  for (const entry of loadAnalyzeHistory()) {
    const acc = ensureAcc(map, entry.jdText, entry);
    if (!acc.latestAnalyze || entry.savedAt > acc.latestAnalyze.savedAt) {
      acc.latestAnalyze = entry;
    }
  }
  for (const entry of loadMatchHistory()) {
    const acc = ensureAcc(map, entry.jdText, entry);
    if (!acc.latestMatch || entry.savedAt > acc.latestMatch.savedAt) {
      acc.latestMatch = entry;
    }
  }
  for (const entry of loadCoverLetterHistory()) {
    const acc = ensureAcc(map, entry.jdText, entry);
    if (!acc.latestCoverLetter || entry.savedAt > acc.latestCoverLetter.savedAt) {
      acc.latestCoverLetter = entry;
    }
  }
  for (const entry of loadInterviewHistory()) {
    const acc = ensureAcc(map, entry.jdText, entry);
    if (!acc.latestInterview || entry.savedAt > acc.latestInterview.savedAt) {
      acc.latestInterview = entry;
    }
  }

  return Array.from(map.values())
    .map(finalize)
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

export function findJobByJdText(jdText: string): Job | null {
  const id = hashJdText(jdText);
  return buildJobIndex().find((j) => j.id === id) ?? null;
}

export function findJobById(id: string): Job | null {
  return buildJobIndex().find((j) => j.id === id) ?? null;
}
