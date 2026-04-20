"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FadeIn } from "@/components/motion";
import { buildJobIndex, type Job } from "@/lib/storage/job-index";
import { JOB_STATUS_LABEL, type JobStatus } from "@/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | JobStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "explore", label: JOB_STATUS_LABEL.explore },
  { value: "applying", label: JOB_STATUS_LABEL.applying },
  { value: "interview", label: JOB_STATUS_LABEL.interview },
  { value: "done", label: JOB_STATUS_LABEL.done },
  { value: "dropped", label: JOB_STATUS_LABEL.dropped },
];

const STATUS_STYLE: Record<JobStatus, string> = {
  explore: "bg-muted text-foreground",
  applying: "bg-accent text-accent-foreground",
  interview: "bg-foreground text-background",
  done: "bg-accent/20 text-accent-foreground",
  dropped: "bg-muted text-muted-foreground",
};

function relativeTime(ts: number): string {
  if (!ts) return "—";
  const diffSec = (Date.now() - ts) / 1000;
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

function daysUntil(deadline: string): number | null {
  const [y, m, d] = deadline.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function JobCard({ job }: { job: Job }) {
  const dLeft = job.deadline ? daysUntil(job.deadline) : null;
  const progressDots = (["a", "m", "c", "i"] as const).map((k, i) => {
    const filled = [
      job.hasAnalyze,
      job.hasMatch,
      job.hasCoverLetter,
      job.hasInterview,
    ][i];
    return filled ? (
      <span key={k} className="h-1.5 w-1.5 rounded-full bg-accent" />
    ) : (
      <span key={k} className="h-1.5 w-1.5 rounded-full bg-border" />
    );
  });

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block p-6 bg-card border border-border rounded-lg elevation-sm hover:elevation-md transition-all duration-100 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold",
            STATUS_STYLE[job.status],
          )}
        >
          {JOB_STATUS_LABEL[job.status]}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          {dLeft !== null && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded",
                dLeft < 0 && "text-muted-foreground",
                dLeft >= 0 && dLeft <= 3 && "bg-destructive/10 text-destructive",
                dLeft > 3 && dLeft <= 7 && "bg-accent/10 text-accent-foreground",
              )}
            >
              {dLeft < 0 ? "마감" : `D-${dLeft}`}
            </span>
          )}
          <span>{relativeTime(job.lastActivityAt)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-1 truncate">
        {job.companyName}
      </p>
      <h3 className="text-base font-bold text-foreground leading-snug line-clamp-2 min-h-[2.6em]">
        {job.jobTitle}
      </h3>
      {job.focusPosition && (
        <p className="text-[11px] text-muted-foreground mt-1 truncate">
          · {job.focusPosition}
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">{progressDots}</div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {job.progress}/4
        </span>
      </div>
    </Link>
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    setJobs(buildJobIndex());
    setLoaded(true);
  }, []);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: jobs.length,
      explore: 0,
      applying: 0,
      interview: 0,
      done: 0,
      dropped: 0,
    };
    for (const j of jobs) base[j.status] += 1;
    return base;
  }, [jobs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return jobs
      .filter((j) => statusFilter === "all" || j.status === statusFilter)
      .filter((j) => {
        if (!query) return true;
        return (
          j.jobTitle.toLowerCase().includes(query) ||
          j.companyName.toLowerCase().includes(query) ||
          (j.focusPosition ?? "").toLowerCase().includes(query)
        );
      });
  }, [jobs, q, statusFilter]);

  return (
    <AppShell
      ribbonLeft={<>JOB 보드</>}
      ribbonRight={
        <>
          {loaded ? `${jobs.length}개 공고` : "로딩"}
        </>
      }
    >
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
                JOB 보드
              </h1>
              <p className="text-sm text-muted-foreground">
                분석·매칭·자소서·면접을 공고 단위로 통합 관리합니다.
              </p>
            </div>
            <Button
              onClick={() => router.push("/jobs/new")}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              + 새 공고
            </Button>

          </div>
        </FadeIn>

        <FadeIn delay={0.03}>
          <div className="mb-6">
            <Input
              type="text"
              placeholder="회사 · 직무 · 포지션 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              const count = counts[f.value];
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-card text-foreground border-border hover:bg-muted",
                  )}
                >
                  <span>{f.label}</span>
                  <span
                    className={cn(
                      "tabular-nums text-[10px]",
                      active ? "text-accent-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </FadeIn>

        {loaded && jobs.length === 0 && (
          <FadeIn delay={0.05}>
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <p className="text-lg font-bold mb-2">아직 공고가 없어요</p>
              <p className="text-sm text-muted-foreground mb-6">
                홈에서 URL 을 붙여넣어 첫 공고를 만들어 보세요.
              </p>
              <Button
                onClick={() => router.push("/jobs/new")}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                공고 입력하러 가기 →
              </Button>
            </div>
          </FadeIn>
        )}

        {loaded && jobs.length > 0 && filtered.length === 0 && (
          <FadeIn delay={0.05}>
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">
                검색 결과가 없어요. 필터를 조정해보세요.
              </p>
            </div>
          </FadeIn>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
