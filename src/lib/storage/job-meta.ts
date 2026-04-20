import { JobMetaSchema, type JobMeta, type JobStatus } from "@/types";
import { z } from "zod";
import { emitJobsChanged } from "./events";
import {
  pushJobMetaUpsert,
  pushJobMetaDelete,
  pushJobMetaClear,
} from "@/lib/sync/push";

const META_KEY = "jobscout:jobMeta";

const MetaMapSchema = z.record(z.string(), JobMetaSchema);

const DEFAULT_META: JobMeta = {
  status: "explore",
  notes: "",
  updatedAt: 0,
};

export function loadAllJobMeta(): Record<string, JobMeta> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return {};
  try {
    return MetaMapSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

function saveAllJobMeta(map: Record<string, JobMeta>): void {
  localStorage.setItem(META_KEY, JSON.stringify(map));
  emitJobsChanged();
}

export function loadJobMeta(jobId: string): JobMeta {
  return loadAllJobMeta()[jobId] ?? { ...DEFAULT_META };
}

export function saveJobMeta(
  jobId: string,
  patch: Partial<Omit<JobMeta, "updatedAt">>,
): JobMeta {
  const all = loadAllJobMeta();
  const prev = all[jobId] ?? { ...DEFAULT_META };
  const next: JobMeta = {
    status: patch.status ?? prev.status,
    notes: patch.notes ?? prev.notes,
    deadline: "deadline" in patch ? patch.deadline : prev.deadline,
    updatedAt: Date.now(),
  };
  all[jobId] = next;
  saveAllJobMeta(all);
  pushJobMetaUpsert(jobId, next);
  return next;
}

export function deleteJobMeta(jobId: string): void {
  const all = loadAllJobMeta();
  delete all[jobId];
  saveAllJobMeta(all);
  pushJobMetaDelete(jobId);
}

export function clearAllJobMeta(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(META_KEY);
  emitJobsChanged();
  pushJobMetaClear();
}

export type { JobMeta, JobStatus };
