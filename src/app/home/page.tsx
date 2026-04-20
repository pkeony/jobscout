"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FadeIn } from "@/components/motion";
import { buildJobIndex, type Job } from "@/lib/storage/job-index";
import { onJobsChanged } from "@/lib/storage/events";
import { loadAnalyzeHistory } from "@/lib/storage/analyze-history";
import { loadHistory as loadMatchHistory } from "@/lib/storage/match-history";
import { loadCoverLetterHistory } from "@/lib/storage/cover-letter-history";
import { loadInterviewHistory } from "@/lib/storage/interview-history";
import { JOB_STATUS_LABEL, type JobStatus } from "@/types";
import type { JobTabValue } from "@/lib/jobs/tabs";
import { cn } from "@/lib/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const TIPS: string[] = [
  "채용공고 URL 하나만 붙여넣으면 스킬·자격·회사 정보를 자동 추출해요.",
  "프로필을 여러 개 만들어 공고별로 맞는 버전을 골라 매칭할 수 있어요.",
  "자소서·면접 결과는 .txt 로 다운로드 가능해요.",
  "면접 질문은 기술 5 · 인성 3 · 상황 2 구성으로 항상 10개 생성됩니다.",
  "상태를 '지원중'으로 바꾸면 공고 카드에 파란 배지가 붙어 한눈에 추적돼요.",
  "분석이 이상하면 워크스페이스 '재분석' 버튼으로 다시 돌릴 수 있어요.",
  "같은 공고의 다른 포지션은 별도 Job 으로 분리되어 따로 관리돼요.",
  "자소서 쓰기 전에 매칭을 돌리면 강점·보완점을 반영한 초안이 나와요.",
];

interface WhatsNewEntry {
  date: string;
  title: string;
  desc: string;
}

const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-04-20",
    title: "JOB 보드 통합",
    desc: "공고 하나에 분석·매칭·자소서·면접·메모가 한 워크스페이스로 묶였어요.",
  },
  {
    date: "2026-04-19",
    title: "다중 포지션 분리",
    desc: "같은 공고 안 여러 포지션을 선택해 각각 독립 Job 으로 관리.",
  },
  {
    date: "2026-04-18",
    title: "Linear 스타일 디자인",
    desc: "Neo-Academic Pixel → Pretendard + indigo accent 전면 리디자인.",
  },
];

const STATUS_STYLE: Record<JobStatus, string> = {
  explore: "bg-muted text-foreground",
  applying: "bg-accent text-accent-foreground",
  interview: "bg-foreground text-background",
  done: "bg-accent/20 text-accent-foreground",
  dropped: "bg-muted text-muted-foreground",
};

function daysUntil(deadline: string): number | null {
  const [y, m, d] = deadline.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function relativeTime(ts: number): string {
  if (!ts) return "—";
  const diffSec = (Date.now() - ts) / 1000;
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

interface WeekActivity {
  analyze: number;
  match: number;
  coverLetter: number;
  interview: number;
}

function computeWeekActivity(): WeekActivity {
  const threshold = Date.now() - WEEK_MS;
  return {
    analyze: loadAnalyzeHistory().filter((e) => e.savedAt > threshold).length,
    match: loadMatchHistory().filter((e) => e.savedAt > threshold).length,
    coverLetter: loadCoverLetterHistory().filter((e) => e.savedAt > threshold)
      .length,
    interview: loadInterviewHistory().filter((e) => e.savedAt > threshold)
      .length,
  };
}

function nextActionForJob(
  job: Job,
): { label: string; tab: JobTabValue } | null {
  if (!job.hasAnalyze) return { label: "분석 시작", tab: "analyze" };
  if (!job.hasMatch) return { label: "프로필 매칭", tab: "match" };
  if (!job.hasCoverLetter) return { label: "자소서 작성", tab: "cover-letter" };
  if (!job.hasInterview) return { label: "면접 질문 생성", tab: "interview" };
  return null;
}

export default function HomeHubPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [weekActivity, setWeekActivity] = useState<WeekActivity>({
    analyze: 0,
    match: 0,
    coverLetter: 0,
    interview: 0,
  });

  useEffect(() => {
    setJobs(buildJobIndex());
    setWeekActivity(computeWeekActivity());
    setLoaded(true);
  }, []);

  useEffect(() => {
    return onJobsChanged(() => {
      setJobs(buildJobIndex());
      setWeekActivity(computeWeekActivity());
    });
  }, []);

  const stats = useMemo(() => {
    const total = jobs.length;
    const applying = jobs.filter((j) => j.status === "applying").length;
    const interview = jobs.filter((j) => j.status === "interview").length;
    const urgent = jobs.filter((j) => {
      if (!j.deadline) return false;
      const d = daysUntil(j.deadline);
      return d !== null && d >= 0 && d <= 3;
    }).length;
    return { total, applying, interview, urgent };
  }, [jobs]);

  const pendingActions = useMemo(() => {
    const activeJobs = jobs.filter(
      (j) => j.status !== "done" && j.status !== "dropped",
    );
    return activeJobs
      .map((j) => {
        const act = nextActionForJob(j);
        return act ? { job: j, action: act } : null;
      })
      .filter((x): x is { job: Job; action: { label: string; tab: JobTabValue } } =>
        x !== null,
      )
      .slice(0, 5);
  }, [jobs]);

  const recentFallback = useMemo(() => jobs.slice(0, 3), [jobs]);

  const todayTip = useMemo(() => {
    const idx = Math.floor(Date.now() / 86400000) % TIPS.length;
    return TIPS[idx];
  }, []);

  const weekTotal =
    weekActivity.analyze +
    weekActivity.match +
    weekActivity.coverLetter +
    weekActivity.interview;

  return (
    <AppShell
      ribbonLeft={<>홈</>}
      ribbonRight={
        <>{loaded ? `${stats.total}개 공고` : "로딩"}</>
      }
    >
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <section className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">
                오늘도 한 걸음
              </h1>
              <p className="text-base text-muted-foreground">
                분석부터 면접 준비까지, 공고 단위로 관리하세요.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link
                href="/jobs/new"
                className="inline-flex items-center justify-center gap-1.5 bg-accent text-accent-foreground rounded-md px-5 py-3 text-sm font-semibold elevation-sm hover:bg-accent/90 transition-colors"
              >
                <span>+</span>
                <span>새 공고</span>
              </Link>
              <Link
                href="/jobs"
                className="inline-flex items-center justify-center bg-card border border-border rounded-md px-5 py-3 text-sm font-medium text-foreground hover:bg-card/60 transition-colors"
              >
                JOB 보드 →
              </Link>
            </div>
          </section>
        </FadeIn>

        <FadeIn delay={0.03}>
          <StatsInlineBar stats={stats} />
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
          <div className="lg:col-span-2 space-y-8">
            <FadeIn delay={0.05}>
              <section>
                <SectionHeader
                  title={pendingActions.length > 0 ? "다음 할 일" : "최근 공고"}
                  subtitle={
                    pendingActions.length > 0
                      ? "공고별 미완료 단계"
                      : "최근 작업한 공고"
                  }
                />
                {loaded && jobs.length === 0 ? (
                  <EmptyState />
                ) : pendingActions.length > 0 ? (
                  <NextActionsList actions={pendingActions} />
                ) : (
                  <RecentJobsList jobs={recentFallback} />
                )}
              </section>
            </FadeIn>
          </div>

          <aside className="space-y-6">
            <FadeIn delay={0.07}>
              <WeekActivityCard total={weekTotal} activity={weekActivity} />
            </FadeIn>
            <FadeIn delay={0.08}>
              <TipCard tip={todayTip} />
            </FadeIn>
            <FadeIn delay={0.09}>
              <WhatsNewCard entries={WHATS_NEW} />
            </FadeIn>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 mb-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && (
        <span className="text-xs text-muted-foreground">· {subtitle}</span>
      )}
    </div>
  );
}

function StatsInlineBar({
  stats,
}: {
  stats: { total: number; applying: number; interview: number; urgent: number };
}) {
  const items = [
    { label: "전체", value: stats.total, tone: "neutral" as const },
    { label: "지원중", value: stats.applying, tone: "accent" as const },
    { label: "면접", value: stats.interview, tone: "neutral" as const },
    {
      label: "D-3 이내",
      value: stats.urgent,
      tone: stats.urgent > 0 ? ("danger" as const) : ("neutral" as const),
    },
  ];
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 bg-card border border-border rounded-lg px-6 py-4 elevation-sm">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "flex items-baseline gap-2",
            i > 0 && "md:pl-8 md:border-l md:border-border",
          )}
        >
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span
            className={cn(
              "text-xl font-black tabular-nums",
              item.tone === "accent" && "text-accent-foreground",
              item.tone === "danger" && "text-destructive",
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-10 text-center bg-card/50">
      <p className="text-base font-medium mb-2">아직 공고가 없어요</p>
      <p className="text-sm text-muted-foreground mb-5">
        첫 공고를 분석해보세요.
      </p>
      <Link
        href="/jobs/new"
        className="inline-flex items-center justify-center gap-1.5 bg-accent text-accent-foreground rounded-md px-5 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors"
      >
        + 새 공고
      </Link>
    </div>
  );
}

function NextActionsList({
  actions,
}: {
  actions: { job: Job; action: { label: string; tab: JobTabValue } }[];
}) {
  return (
    <ul className="bg-card border border-border rounded-lg divide-y divide-border elevation-sm overflow-hidden">
      {actions.map(({ job, action }) => {
        const dLeft = job.deadline ? daysUntil(job.deadline) : null;
        return (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}?tab=${action.tab}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-card/60 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground mb-0.5 truncate">
                  {job.companyName}
                  {job.focusPosition ? ` · ${job.focusPosition}` : ""}
                </p>
                <p className="text-sm font-semibold truncate">
                  {job.jobTitle}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {dLeft !== null && dLeft >= 0 && dLeft <= 7 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded tabular-nums",
                      dLeft <= 3
                        ? "bg-destructive/10 text-destructive"
                        : "bg-accent/10 text-accent-foreground",
                    )}
                  >
                    D-{dLeft}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {job.progress}/4
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-foreground bg-accent/10 border border-accent/30 rounded-full px-3 py-1 group-hover:bg-accent/20 transition-colors">
                  <span className="text-accent">→</span>
                  <span>{action.label}</span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecentJobsList({ jobs }: { jobs: Job[] }) {
  return (
    <ul className="bg-card border border-border rounded-lg divide-y divide-border elevation-sm overflow-hidden">
      {jobs.map((job) => {
        const dLeft = job.deadline ? daysUntil(job.deadline) : null;
        return (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-card/60 transition-colors"
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0",
                  STATUS_STYLE[job.status],
                )}
              >
                {JOB_STATUS_LABEL[job.status]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground mb-0.5 truncate">
                  {job.companyName}
                </p>
                <p className="text-sm font-semibold truncate">
                  {job.jobTitle}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground">
                {dLeft !== null && <span>D-{Math.max(dLeft, 0)}</span>}
                <span>{relativeTime(job.lastActivityAt)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface WeekActivityCardProps {
  total: number;
  activity: WeekActivity;
}

function WeekActivityCard({ total, activity }: WeekActivityCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 elevation-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        이번 주 활동
      </p>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-black tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">건</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">분석</dt>
          <dd className="font-semibold tabular-nums">{activity.analyze}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">매칭</dt>
          <dd className="font-semibold tabular-nums">{activity.match}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">자소서</dt>
          <dd className="font-semibold tabular-nums">{activity.coverLetter}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">면접</dt>
          <dd className="font-semibold tabular-nums">{activity.interview}</dd>
        </div>
      </dl>
    </div>
  );
}

function TipCard({ tip }: { tip: string }) {
  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        💡 오늘의 팁
      </p>
      <p className="text-sm leading-relaxed text-foreground">{tip}</p>
    </div>
  );
}

function WhatsNewCard({ entries }: { entries: WhatsNewEntry[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 elevation-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        What&apos;s new
      </p>
      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.date}>
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {e.date.slice(5)}
              </span>
              <span className="text-sm font-semibold">{e.title}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {e.desc}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

