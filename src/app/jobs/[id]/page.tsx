"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FadeIn } from "@/components/motion";
import { AnalyzeTab } from "@/components/jobs/AnalyzeTab";
import { MatchTab } from "@/components/jobs/MatchTab";
import { CoverLetterTab } from "@/components/jobs/CoverLetterTab";
import { InterviewTab } from "@/components/jobs/InterviewTab";
import { findJobById, getJobKey, type Job } from "@/lib/storage/job-index";
import { loadJobMeta, saveJobMeta } from "@/lib/storage/job-meta";
import { JOB_STATUS_LABEL, type JobStatus } from "@/types";
import { cn } from "@/lib/utils";

const TAB_VALUES = ["analyze", "match", "cover-letter", "interview", "notes"] as const;
type TabValue = (typeof TAB_VALUES)[number];

const TAB_LABELS: Record<TabValue, string> = {
  analyze: "분석",
  match: "매칭",
  "cover-letter": "자소서",
  interview: "면접",
  notes: "메모",
};

function hasResultForTab(job: Job, tab: TabValue): boolean {
  switch (tab) {
    case "analyze":
      return job.hasAnalyze;
    case "match":
      return job.hasMatch;
    case "cover-letter":
      return job.hasCoverLetter;
    case "interview":
      return job.hasInterview;
    case "notes":
      return true;
  }
}

function firstMissingTab(job: Job): TabValue {
  if (!job.hasAnalyze) return "analyze";
  if (!job.hasMatch) return "match";
  if (!job.hasCoverLetter) return "cover-letter";
  if (!job.hasInterview) return "interview";
  return "analyze";
}

function nextActionNudge(job: Job): { label: string; tab: TabValue | null } {
  if (!job.hasAnalyze)
    return { label: "분석을 시작하세요", tab: "analyze" };
  if (!job.hasMatch)
    return { label: "프로필 매칭으로 적합도 확인", tab: "match" };
  if (!job.hasCoverLetter)
    return { label: "자소서 초안을 생성하세요", tab: "cover-letter" };
  if (!job.hasInterview)
    return { label: "면접 예상질문으로 마무리", tab: "interview" };
  if (job.status === "explore")
    return {
      label: "준비 완료 — 상태를 '지원중'으로 업데이트 해보세요",
      tab: null,
    };
  return { label: "모든 준비가 끝났어요", tab: null };
}

function JobWorkspaceInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = params.id;

  const [job, setJob] = useState<Job | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSavedAt, setNotesSavedAt] = useState<number>(0);

  const autoStartFlag = searchParams.get("autostart") === "1";
  const initialTabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    if (initialTabParam && TAB_VALUES.includes(initialTabParam as TabValue)) {
      return initialTabParam as TabValue;
    }
    return "analyze";
  });

  const resolveJob = useCallback((): Job | null => {
    const found = findJobById(jobId);
    if (found) return found;
    if (typeof window === "undefined") return null;
    const pendingJdText = sessionStorage.getItem("jobscout:jdText");
    if (!pendingJdText) return null;
    const focus =
      sessionStorage.getItem("jobscout:focusPosition") ?? undefined;
    if (getJobKey(pendingJdText, focus) !== jobId) return null;
    const metaRaw = sessionStorage.getItem("jobscout:crawlMeta");
    let crawl: { title?: string; company?: string; url?: string } = {};
    if (metaRaw) {
      try {
        crawl = JSON.parse(metaRaw) as typeof crawl;
      } catch {
        /* ignore */
      }
    }
    const meta = loadJobMeta(jobId);
    const pending: Job = {
      id: jobId,
      jdText: pendingJdText,
      jobTitle: crawl.title || "제목 없음",
      companyName: crawl.company || "회사명 미확인",
      jobUrl: crawl.url || undefined,
      focusPosition: focus,
      hasAnalyze: false,
      hasMatch: false,
      hasCoverLetter: false,
      hasInterview: false,
      progress: 0,
      lastActivityAt: Date.now(),
      status: meta.status,
      notes: meta.notes,
      deadline: meta.deadline,
    };
    return pending;
  }, [jobId]);

  const reloadJob = useCallback(() => {
    const found = resolveJob();
    setJob(found);
    if (found) {
      setNotesDraft(found.notes);
    }
  }, [resolveJob]);

  useEffect(() => {
    const found = resolveJob();
    setLoaded(true);
    if (!found) {
      router.replace("/jobs");
      return;
    }
    setJob(found);
    const meta = loadJobMeta(found.id);
    setNotesDraft(meta.notes);
    setNotesSavedAt(meta.updatedAt);

    sessionStorage.setItem("jobscout:jdText", found.jdText);
    sessionStorage.setItem(
      "jobscout:crawlMeta",
      JSON.stringify({
        title: found.jobTitle,
        company: found.companyName,
        url: found.jobUrl ?? "",
      }),
    );
    if (found.focusPosition) {
      sessionStorage.setItem("jobscout:focusPosition", found.focusPosition);
    } else {
      sessionStorage.removeItem("jobscout:focusPosition");
    }
    if (found.latestAnalyze) {
      sessionStorage.setItem(
        "jobscout:analyzeResult",
        JSON.stringify(found.latestAnalyze.analysisResult),
      );
    }
    if (found.latestCoverLetter) {
      sessionStorage.setItem(
        "jobscout:coverLetterResult",
        JSON.stringify(found.latestCoverLetter.coverLetterResult),
      );
    }
    if (found.latestInterview) {
      sessionStorage.setItem(
        "jobscout:interviewResult",
        JSON.stringify(found.latestInterview.interviewResult),
      );
    }
    // 레거시 /history "다시 보기" 에서 남긴 스테일 키 정리
    sessionStorage.removeItem("jobscout:matchResultRestore");

    if (!initialTabParam) {
      setActiveTab(firstMissingTab(found));
    }
  }, [jobId, router, initialTabParam, resolveJob]);

  const handleStatusChange = useCallback(
    (status: JobStatus) => {
      if (!job) return;
      saveJobMeta(job.id, { status });
      setJob({ ...job, status });
    },
    [job],
  );

  const handleDeadlineChange = useCallback(
    (deadline: string) => {
      if (!job) return;
      const patch = deadline ? { deadline } : { deadline: undefined };
      saveJobMeta(job.id, patch);
      setJob({ ...job, deadline: deadline || undefined });
    },
    [job],
  );

  const handleNotesBlur = useCallback(() => {
    if (!job) return;
    if (notesDraft === job.notes) return;
    const meta = saveJobMeta(job.id, { notes: notesDraft });
    setNotesSavedAt(meta.updatedAt);
    setJob({ ...job, notes: notesDraft });
  }, [job, notesDraft]);

  const nudge = useMemo(() => (job ? nextActionNudge(job) : null), [job]);

  if (!loaded) {
    return (
      <AppShell ribbonLeft={<>공고</>} ribbonRight={<>로딩</>}>
        <div className="max-w-5xl mx-auto py-12 text-center text-sm text-muted-foreground">
          공고 불러오는 중...
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell ribbonLeft={<>공고</>} ribbonRight={<>없음</>}>
        <div className="max-w-5xl mx-auto py-12 text-center text-sm text-muted-foreground">
          공고를 찾을 수 없어요.
        </div>
      </AppShell>
    );
  }

  // 분석 미완료 공고: full-screen progress 모드.
  // 분석 완료 시 onCompleted → reloadJob → hasAnalyze=true → 정상 탭 UI 로 전환.
  if (!job.hasAnalyze) {
    return (
      <AppShell
        ribbonLeft={<>공고 분석</>}
        ribbonRight={<>STATUS: PENDING</>}
      >
        <div className="max-w-6xl mx-auto">
          <Link
            href="/jobs"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
          >
            ← 공고 목록
          </Link>
          <p className="text-sm text-muted-foreground mb-1">
            {job.companyName}
            {job.focusPosition ? ` · ${job.focusPosition}` : ""}
          </p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-8">
            {job.jobTitle}
          </h1>
          <AnalyzeTab
            key={`analyze-${job.id}`}
            job={job}
            autoStart={autoStartFlag}
            onCompleted={reloadJob}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      ribbonLeft={<>공고 워크스페이스</>}
      ribbonRight={
        <>
          {job.progress}/4 완료 · {JOB_STATUS_LABEL[job.status]}
        </>
      }
    >
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="mb-6">
            <Link
              href="/jobs"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
            >
              ← 공고 목록
            </Link>
            <p className="text-sm text-muted-foreground mb-1">
              {job.companyName}
              {job.focusPosition ? ` · ${job.focusPosition}` : ""}
            </p>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-5">
              {job.jobTitle}
            </h1>

            <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-lg elevation-sm">
              <label className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground">
                  상태
                </span>
                <select
                  value={job.status}
                  onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
                  className="bg-card border border-input rounded-md px-2.5 py-1 text-sm"
                >
                  {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {JOB_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground">
                  마감일
                </span>
                <Input
                  type="date"
                  value={job.deadline ?? ""}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </label>

              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 ml-auto"
                >
                  원본 공고 ↗
                </a>
              )}
            </div>

            {nudge && nudge.tab && (
              <button
                onClick={() => nudge.tab && setActiveTab(nudge.tab)}
                className="mt-3 text-sm text-accent-foreground bg-accent/10 border border-accent/30 rounded-md px-4 py-2 inline-flex items-center gap-2 hover:bg-accent/20 transition-colors"
              >
                <span className="text-accent">→</span>
                <span>{nudge.label}</span>
              </button>
            )}
            {nudge && !nudge.tab && (
              <p className="mt-3 text-sm text-muted-foreground">
                {nudge.label}
              </p>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.03}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabValue)}
          >
            <TabsList variant="line" className="mb-6 w-full flex-wrap">
              {TAB_VALUES.map((v) => (
                <TabsTrigger key={v} value={v} className="flex-none">
                  <span>{TAB_LABELS[v]}</span>
                  {hasResultForTab(job, v) && v !== "notes" && (
                    <span
                      className={cn(
                        "ml-1.5 text-[10px]",
                        activeTab === v ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      ✓
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="analyze">
              <AnalyzeTab
                key={`analyze-${job.id}`}
                job={job}
                autoStart={autoStartFlag && activeTab === "analyze"}
                onCompleted={reloadJob}
              />
            </TabsContent>

            <TabsContent value="match">
              <MatchTab
                key={`match-${job.id}`}
                job={job}
                onCompleted={reloadJob}
              />
            </TabsContent>

            <TabsContent value="cover-letter">
              <CoverLetterTab
                key={`cover-letter-${job.id}`}
                job={job}
                onCompleted={reloadJob}
              />
            </TabsContent>

            <TabsContent value="interview">
              <InterviewTab
                key={`interview-${job.id}`}
                job={job}
                onCompleted={reloadJob}
              />
            </TabsContent>

            <TabsContent value="notes">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">메모</h3>
                  <span className="text-[10px] text-muted-foreground">
                    자동 저장 ·{" "}
                    {notesSavedAt
                      ? new Date(notesSavedAt).toLocaleString("ko-KR")
                      : "미저장"}
                  </span>
                </div>
                <Textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows={16}
                  placeholder="공고에 대한 메모, 면접 준비 체크리스트, 지원 후기 등을 자유롭게 적어두세요."
                />
              </div>
            </TabsContent>
          </Tabs>
        </FadeIn>
      </div>
    </AppShell>
  );
}

export default function JobWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <JobWorkspaceInner />
    </Suspense>
  );
}
