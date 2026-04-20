"use client";

import { z } from "zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emitJobsChanged } from "@/lib/storage/events";
import {
  AnalyzeHistoryEntrySchema,
  MatchHistoryEntrySchema,
  CoverLetterHistoryEntrySchema,
  InterviewHistoryEntrySchema,
  ProfileSlotSchema,
  type AnalyzeHistoryEntry,
  type MatchHistoryEntry,
  type CoverLetterHistoryEntry,
  type InterviewHistoryEntry,
  type ProfileSlot,
  type JobMeta,
  type JobStatus,
} from "@/types";

type PayloadRow = { payload: unknown };

function parsePayloads<T>(
  rows: PayloadRow[] | null | undefined,
  schema: z.ZodType<T>,
  label: string,
): T[] {
  if (!rows) return [];
  const out: T[] = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row.payload);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      console.warn(`[sync] ${label} payload invalid, skipping`, parsed.error);
    }
  }
  return out;
}

const KEYS = {
  PROFILES: "jobscout:profiles",
  ACTIVE_PROFILE: "jobscout:activeProfileId",
  ANALYZE: "jobscout:analyzeHistory",
  MATCH: "jobscout:matchHistory",
  COVER_LETTER: "jobscout:coverLetterHistory",
  INTERVIEW: "jobscout:interviewHistory",
  JOB_META: "jobscout:jobMeta",
} as const;

export async function pullAllFromSupabase(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const sb = createSupabaseBrowserClient();

  const [
    profilesRes,
    profileMetaRes,
    analyzeRes,
    matchRes,
    coverRes,
    interviewRes,
    jobMetaRes,
  ] = await Promise.all([
    sb
      .from("user_profiles")
      .select("payload")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    sb
      .from("profiles")
      .select("active_profile_id")
      .eq("id", userId)
      .maybeSingle(),
    sb
      .from("analyze_results")
      .select("payload")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(20),
    sb
      .from("match_results")
      .select("payload")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(20),
    sb
      .from("cover_letters")
      .select("payload")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(20),
    sb
      .from("interviews")
      .select("payload")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(20),
    sb
      .from("job_meta")
      .select("job_id,status,notes,deadline,updated_at")
      .eq("user_id", userId),
  ]);

  const profiles: ProfileSlot[] = parsePayloads(
    profilesRes.data as PayloadRow[] | null,
    ProfileSlotSchema,
    "user_profiles",
  );
  localStorage.setItem(KEYS.PROFILES, JSON.stringify(profiles));

  const activeId =
    (profileMetaRes.data?.active_profile_id as string | null) ?? null;
  if (activeId) localStorage.setItem(KEYS.ACTIVE_PROFILE, activeId);
  else localStorage.removeItem(KEYS.ACTIVE_PROFILE);

  const analyze: AnalyzeHistoryEntry[] = parsePayloads(
    analyzeRes.data as PayloadRow[] | null,
    AnalyzeHistoryEntrySchema,
    "analyze_results",
  );
  localStorage.setItem(KEYS.ANALYZE, JSON.stringify(analyze));

  const match: MatchHistoryEntry[] = parsePayloads(
    matchRes.data as PayloadRow[] | null,
    MatchHistoryEntrySchema,
    "match_results",
  );
  localStorage.setItem(KEYS.MATCH, JSON.stringify(match));

  const cover: CoverLetterHistoryEntry[] = parsePayloads(
    coverRes.data as PayloadRow[] | null,
    CoverLetterHistoryEntrySchema,
    "cover_letters",
  );
  localStorage.setItem(KEYS.COVER_LETTER, JSON.stringify(cover));

  const interview: InterviewHistoryEntry[] = parsePayloads(
    interviewRes.data as PayloadRow[] | null,
    InterviewHistoryEntrySchema,
    "interviews",
  );
  localStorage.setItem(KEYS.INTERVIEW, JSON.stringify(interview));

  type JobMetaRow = {
    job_id: string;
    status: string;
    notes: string;
    deadline: string | null;
    updated_at: string;
  };
  const jobMeta: Record<string, JobMeta> = {};
  for (const row of (jobMetaRes.data as JobMetaRow[] | null) ?? []) {
    jobMeta[row.job_id] = {
      status: row.status as JobStatus,
      notes: row.notes,
      deadline: row.deadline ?? undefined,
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }
  localStorage.setItem(KEYS.JOB_META, JSON.stringify(jobMeta));
  // legacy migration 플래그 — DB 기반으로 전환했으므로 "done" 으로 고정
  localStorage.setItem("jobscout:profileMigrated", "done");

  emitJobsChanged();
}
