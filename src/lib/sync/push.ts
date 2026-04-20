"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "./user-session";
import { getJobKey } from "@/lib/storage/job-index";
import type {
  AnalyzeHistoryEntry,
  MatchHistoryEntry,
  CoverLetterHistoryEntry,
  InterviewHistoryEntry,
  ProfileSlot,
  JobMeta,
} from "@/types";

type HistoryTable =
  | "analyze_results"
  | "match_results"
  | "cover_letters"
  | "interviews";

type HistoryEntry =
  | AnalyzeHistoryEntry
  | MatchHistoryEntry
  | CoverLetterHistoryEntry
  | InterviewHistoryEntry;

function sb() {
  return createSupabaseBrowserClient();
}

async function upsertJob(
  userId: string,
  e: {
    jdText: string;
    jobTitle: string;
    companyName: string;
    jobUrl?: string;
    focusPosition?: string;
  },
): Promise<string> {
  const id = getJobKey(e.jdText, e.focusPosition);
  const { error } = await sb()
    .from("jobs")
    .upsert(
      {
        user_id: userId,
        id,
        jd_text: e.jdText,
        job_title: e.jobTitle,
        company_name: e.companyName,
        focus_position: e.focusPosition ?? null,
        job_url: e.jobUrl ?? null,
      },
      { onConflict: "user_id,id" },
    );
  if (error) throw error;
  return id;
}

async function pushHistoryEntry(
  table: HistoryTable,
  entry: HistoryEntry,
): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    const jobId = await upsertJob(userId, entry);
    const { error } = await sb()
      .from(table)
      .upsert(
        {
          user_id: userId,
          entry_id: entry.id,
          job_id: jobId,
          payload: entry,
          saved_at: new Date(entry.savedAt).toISOString(),
        },
        { onConflict: "user_id,entry_id" },
      );
    if (error) throw error;
  } catch (err) {
    console.error(`[sync] push ${table} failed`, err);
  }
}

export function pushAnalyzeEntry(e: AnalyzeHistoryEntry) {
  void pushHistoryEntry("analyze_results", e);
}
export function pushMatchEntry(e: MatchHistoryEntry) {
  void pushHistoryEntry("match_results", e);
}
export function pushCoverLetterEntry(e: CoverLetterHistoryEntry) {
  void pushHistoryEntry("cover_letters", e);
}
export function pushInterviewEntry(e: InterviewHistoryEntry) {
  void pushHistoryEntry("interviews", e);
}

async function pushHistoryDelete(
  table: HistoryTable,
  entryId: string,
): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    const { error } = await sb()
      .from(table)
      .delete()
      .eq("user_id", userId)
      .eq("entry_id", entryId);
    if (error) throw error;
  } catch (err) {
    console.error(`[sync] delete ${table} failed`, err);
  }
}

export function pushAnalyzeDelete(id: string) {
  void pushHistoryDelete("analyze_results", id);
}
export function pushMatchDelete(id: string) {
  void pushHistoryDelete("match_results", id);
}
export function pushCoverLetterDelete(id: string) {
  void pushHistoryDelete("cover_letters", id);
}
export function pushInterviewDelete(id: string) {
  void pushHistoryDelete("interviews", id);
}

async function pushHistoryClear(table: HistoryTable): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  try {
    const { error } = await sb().from(table).delete().eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    console.error(`[sync] clear ${table} failed`, err);
  }
}

export function pushAnalyzeClear() {
  void pushHistoryClear("analyze_results");
}
export function pushMatchClear() {
  void pushHistoryClear("match_results");
}
export function pushCoverLetterClear() {
  void pushHistoryClear("cover_letters");
}
export function pushInterviewClear() {
  void pushHistoryClear("interviews");
}

export function pushProfileUpsert(slot: ProfileSlot) {
  void (async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await sb()
        .from("user_profiles")
        .upsert(
          { user_id: userId, entry_id: slot.id, payload: slot },
          { onConflict: "user_id,entry_id" },
        );
      if (error) throw error;
    } catch (err) {
      console.error("[sync] pushProfileUpsert failed", err);
    }
  })();
}

export function pushProfileDelete(entryId: string) {
  void (async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await sb()
        .from("user_profiles")
        .delete()
        .eq("user_id", userId)
        .eq("entry_id", entryId);
      if (error) throw error;
    } catch (err) {
      console.error("[sync] pushProfileDelete failed", err);
    }
  })();
}

export function pushActiveProfileId(id: string | null) {
  void (async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await sb()
        .from("profiles")
        .update({ active_profile_id: id })
        .eq("id", userId);
      if (error) throw error;
    } catch (err) {
      console.error("[sync] pushActiveProfileId failed", err);
    }
  })();
}

export function pushJobMetaUpsert(jobId: string, meta: JobMeta) {
  void (async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await sb()
        .from("job_meta")
        .upsert(
          {
            user_id: userId,
            job_id: jobId,
            status: meta.status,
            notes: meta.notes,
            deadline: meta.deadline ?? null,
          },
          { onConflict: "user_id,job_id" },
        );
      if (error) throw error;
    } catch (err) {
      console.error("[sync] pushJobMetaUpsert failed", err);
    }
  })();
}

export function pushJobMetaDelete(jobId: string) {
  void (async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await sb()
        .from("job_meta")
        .delete()
        .eq("user_id", userId)
        .eq("job_id", jobId);
      if (error) throw error;
    } catch (err) {
      console.error("[sync] pushJobMetaDelete failed", err);
    }
  })();
}

export function pushJobMetaClear() {
  void (async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
      const { error } = await sb()
        .from("job_meta")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    } catch (err) {
      console.error("[sync] pushJobMetaClear failed", err);
    }
  })();
}
