"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadProfiles, getActiveProfileId } from "@/lib/storage/profiles";
import { loadAnalyzeHistory } from "@/lib/storage/analyze-history";
import { loadHistory as loadMatchHistory } from "@/lib/storage/match-history";
import { loadCoverLetterHistory } from "@/lib/storage/cover-letter-history";
import { loadInterviewHistory } from "@/lib/storage/interview-history";
import { loadAllJobMeta } from "@/lib/storage/job-meta";
import { getJobKey } from "@/lib/storage/job-index";

export interface MigrationCounts {
  profiles: number;
  analyze: number;
  match: number;
  coverLetter: number;
  interview: number;
  jobMeta: number;
}

export function countLocalData(): MigrationCounts {
  return {
    profiles: loadProfiles().length,
    analyze: loadAnalyzeHistory().length,
    match: loadMatchHistory().length,
    coverLetter: loadCoverLetterHistory().length,
    interview: loadInterviewHistory().length,
    jobMeta: Object.keys(loadAllJobMeta()).length,
  };
}

export function hasAnyLocalData(): boolean {
  const c = countLocalData();
  return (
    c.profiles +
      c.analyze +
      c.match +
      c.coverLetter +
      c.interview +
      c.jobMeta >
    0
  );
}

interface JobRow {
  user_id: string;
  id: string;
  jd_text: string;
  job_title: string | null;
  company_name: string | null;
  focus_position: string | null;
  job_url: string | null;
}

interface JobBase {
  jdText: string;
  jobTitle: string;
  companyName: string;
  jobUrl?: string;
  focusPosition?: string;
}

export async function migrateLocalToSupabase(
  userId: string,
): Promise<MigrationCounts> {
  const sb = createSupabaseBrowserClient();

  const profiles = loadProfiles();
  const analyze = loadAnalyzeHistory();
  const match = loadMatchHistory();
  const cover = loadCoverLetterHistory();
  const interview = loadInterviewHistory();
  const jobMeta = loadAllJobMeta();

  const jobs = new Map<string, JobRow>();
  const addJob = (e: JobBase) => {
    const id = getJobKey(e.jdText, e.focusPosition);
    if (jobs.has(id)) return;
    jobs.set(id, {
      user_id: userId,
      id,
      jd_text: e.jdText,
      job_title: e.jobTitle,
      company_name: e.companyName,
      focus_position: e.focusPosition ?? null,
      job_url: e.jobUrl ?? null,
    });
  };
  analyze.forEach(addJob);
  match.forEach(addJob);
  cover.forEach(addJob);
  interview.forEach(addJob);

  if (jobs.size > 0) {
    const { error } = await sb
      .from("jobs")
      .upsert([...jobs.values()], { onConflict: "user_id,id" });
    if (error) throw error;
  }

  const toHistoryRow = (e: JobBase & { id: string; savedAt: number }) => ({
    user_id: userId,
    entry_id: e.id,
    job_id: getJobKey(e.jdText, e.focusPosition),
    payload: e,
    saved_at: new Date(e.savedAt).toISOString(),
  });

  if (analyze.length > 0) {
    const { error } = await sb
      .from("analyze_results")
      .upsert(analyze.map(toHistoryRow), { onConflict: "user_id,entry_id" });
    if (error) throw error;
  }
  if (match.length > 0) {
    const { error } = await sb
      .from("match_results")
      .upsert(match.map(toHistoryRow), { onConflict: "user_id,entry_id" });
    if (error) throw error;
  }
  if (cover.length > 0) {
    const { error } = await sb
      .from("cover_letters")
      .upsert(cover.map(toHistoryRow), { onConflict: "user_id,entry_id" });
    if (error) throw error;
  }
  if (interview.length > 0) {
    const { error } = await sb
      .from("interviews")
      .upsert(interview.map(toHistoryRow), { onConflict: "user_id,entry_id" });
    if (error) throw error;
  }

  if (profiles.length > 0) {
    const { error } = await sb
      .from("user_profiles")
      .upsert(
        profiles.map((p) => ({
          user_id: userId,
          entry_id: p.id,
          payload: p,
        })),
        { onConflict: "user_id,entry_id" },
      );
    if (error) throw error;
  }

  const activeId = getActiveProfileId();
  await sb
    .from("profiles")
    .update({
      active_profile_id: activeId,
      migrated_local_at: new Date().toISOString(),
    })
    .eq("id", userId);

  const jobMetaRows = Object.entries(jobMeta).map(([jobId, meta]) => ({
    user_id: userId,
    job_id: jobId,
    status: meta.status,
    notes: meta.notes,
    deadline: meta.deadline ?? null,
  }));
  if (jobMetaRows.length > 0) {
    const { error } = await sb
      .from("job_meta")
      .upsert(jobMetaRows, { onConflict: "user_id,job_id" });
    if (error) throw error;
  }

  return {
    profiles: profiles.length,
    analyze: analyze.length,
    match: match.length,
    coverLetter: cover.length,
    interview: interview.length,
    jobMeta: Object.keys(jobMeta).length,
  };
}

export async function markMigrationSkipped(userId: string): Promise<void> {
  const sb = createSupabaseBrowserClient();
  await sb
    .from("profiles")
    .update({ migrated_local_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function getMigrationStatus(userId: string): Promise<{
  alreadyMigrated: boolean;
}> {
  const sb = createSupabaseBrowserClient();
  const { data } = await sb
    .from("profiles")
    .select("migrated_local_at")
    .eq("id", userId)
    .maybeSingle();
  return { alreadyMigrated: data?.migrated_local_at != null };
}
