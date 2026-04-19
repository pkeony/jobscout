"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { extractInterviewJson } from "@/lib/prompts/interview";
import {
  AnalysisResultSchema,
  type AnalysisResult,
  type InterviewResult,
  type InterviewQuestion,
} from "@/types";
import { addInterviewHistoryEntry } from "@/lib/storage/interview-history";
import { getActiveProfile } from "@/lib/storage/profiles";
import { downloadInterviewAsTxt } from "@/lib/text-export";
import type { StreamEvent } from "@/lib/ai/types";

function readAnalysisExtras(): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  const cached = sessionStorage.getItem("jobscout:analyzeResult");
  if (cached) {
    try {
      extras.analysisResult = AnalysisResultSchema.parse(JSON.parse(cached));
    } catch {
      // stale 캐시는 무시
    }
  }
  const focus = sessionStorage.getItem("jobscout:focusPosition");
  if (focus) extras.focusPosition = focus;
  return extras;
}
import { cn, friendlyError } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";
import { AppShell } from "@/components/app-shell";

// ─── 질문 카드 (Index Card 스타일) ──────────────────

function QuestionCard({
  question,
  index,
}: {
  question: InterviewQuestion;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  const categoryLabel =
    question.category === "technical"
      ? "기술"
      : question.category === "behavioral"
        ? "인성"
        : "상황";

  const categoryColor =
    question.category === "technical"
      ? "bg-foreground"
      : question.category === "behavioral"
        ? "bg-secondary"
        : "bg-accent";

  return (
    <div className="bg-card border-2 border-foreground/10 overflow-hidden hover:-translate-y-0.5 transition-transform duration-75">
      {/* 카드 헤더 바 */}
      <div className={cn("px-4 py-2 flex items-center justify-between", categoryColor)}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-background">
          Q{String(index + 1).padStart(2, "0")} — {categoryLabel}
        </span>
        <Badge
          variant="outline"
          className="text-[9px] border-background/30 text-background/80"
        >
          {question.intent}
        </Badge>
      </div>

      {/* 질문 본문 */}
      <div className="p-5 cursor-pointer" onClick={() => setOpen(!open)}>
        <p className="text-sm font-medium leading-relaxed">{question.question}</p>
        <button className="mt-3 text-[10px] uppercase tracking-widest text-secondary font-bold flex items-center gap-1">
          {open ? "답변 숨기기 ▲" : "모범 답변 보기 ▼"}
        </button>
      </div>

      {/* 모범 답변 */}
      {open && (
        <div className="px-5 pb-5">
          <div className="bg-muted p-4 border-l-4 border-secondary dot-matrix-texture">
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
              모범 답변
            </p>
            <p className="text-sm leading-relaxed">{question.sampleAnswer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스트리밍 스켈레톤 ──────────────────────────────

function InterviewSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border-2 border-foreground/10 overflow-hidden">
            <div className="bg-foreground/10 px-4 py-2">
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="p-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-foreground p-1">
        <div className="px-4 py-2"><Skeleton className="h-3 w-20" /></div>
        <div className="bg-card p-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 결과 뷰 ─────────────────────────────────────

function InterviewResultView({ result }: { result: InterviewResult }) {
  const technical = result.questions.filter((q) => q.category === "technical");
  const behavioral = result.questions.filter((q) => q.category === "behavioral");
  const situational = result.questions.filter((q) => q.category === "situational");

  const sections = [
    { label: "기술 질문", questions: technical, color: "border-foreground" },
    { label: "인성 질문", questions: behavioral, color: "border-secondary" },
    { label: "상황 질문", questions: situational, color: "border-accent" },
  ].filter((s) => s.questions.length > 0);

  let questionIndex = 0;

  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <FadeIn key={section.label}>
          <div className="space-y-4">
            <div className={cn("border-l-4 pl-4 py-1", section.color)}>
              <h2 className="font-heading text-xl font-bold italic">
                {section.label}
              </h2>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {section.questions.length}개 질문
              </span>
            </div>
            <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.questions.map((q) => {
                const idx = questionIndex++;
                return (
                  <StaggerItem key={idx}>
                    <QuestionCard question={q} index={idx} />
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>
        </FadeIn>
      ))}

      {/* 면접 팁 — 다크 프레임 */}
      {result.tips.length > 0 && (
        <FadeIn>
          <div className="bg-foreground p-1">
            <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest flex items-center gap-2 text-background/80">
                <span className="w-2 h-2 bg-secondary" />
                면접 준비 팁
              </span>
              <div className="flex gap-2">
                <span className="w-3 h-3 bg-background/20" />
                <span className="w-3 h-3 bg-background/20" />
                <span className="w-3 h-3 bg-background/20" />
              </div>
            </div>
            <div className="bg-card p-8 dot-matrix-texture">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="font-heading text-lg font-black text-secondary shrink-0">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    <p className="text-sm leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────

export default function InterviewPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const [cachedResult, setCachedResult] = useState<InterviewResult | null>(null);
  const startedRef = useRef(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/interview");

  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);

    // 캐시 확인
    const cached = sessionStorage.getItem("jobscout:interviewResult");
    if (cached) {
      try {
        setCachedResult(JSON.parse(cached) as InterviewResult);
        return;
      } catch { /* 파싱 실패 시 재생성 */ }
    }

    if (!startedRef.current) {
      startedRef.current = true;
      const activeProfile = getActiveProfile();
      start({
        jdText: text,
        ...(activeProfile ? { profile: activeProfile.profile } : {}),
        ...readAnalysisExtras(),
      });
    }
  }, [router, start]);

  const interviewResult = useMemo<InterviewResult | null>(() => {
    if (cachedResult) return cachedResult;
    if (status !== "done" || !fullText) return null;
    try {
      return extractInterviewJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText, cachedResult]);

  // 완료 시 캐싱 + 히스토리 저장
  useEffect(() => {
    if (status !== "done" || !interviewResult || cachedResult) return;

    sessionStorage.setItem("jobscout:interviewResult", JSON.stringify(interviewResult));

    const jdTextRaw = sessionStorage.getItem("jobscout:jdText");
    if (!jdTextRaw) return;

    const crawlMetaRaw = sessionStorage.getItem("jobscout:crawlMeta");
    let jobTitle = "직무명 미확인";
    let companyName = "회사명 미확인";
    let jobUrl: string | undefined;
    try {
      if (crawlMetaRaw) {
        const parsed = JSON.parse(crawlMetaRaw) as {
          title?: string;
          company?: string;
          url?: string;
        };
        if (parsed.title) jobTitle = parsed.title;
        if (parsed.company) companyName = parsed.company;
        jobUrl = parsed.url || undefined;
      }
    } catch {
      // ignore
    }
    const focusPosition =
      sessionStorage.getItem("jobscout:focusPosition") || undefined;
    const extras = readAnalysisExtras();

    addInterviewHistoryEntry({
      jobTitle,
      companyName,
      jobUrl,
      focusPosition,
      jdText: jdTextRaw,
      interviewResult,
      analysisResult: extras.analysisResult as AnalysisResult | undefined,
    });
  }, [status, interviewResult, cachedResult]);

  const effectiveStatus = cachedResult ? "done" : status;

  const handleRetry = () => {
    sessionStorage.removeItem("jobscout:interviewResult");
    setCachedResult(null);
    reset();
    startedRef.current = false;
    const text = sessionStorage.getItem("jobscout:jdText");
    if (text) {
      startedRef.current = true;
      const activeProfile = getActiveProfile();
      start({
        jdText: text,
        ...(activeProfile ? { profile: activeProfile.profile } : {}),
        ...readAnalysisExtras(),
      });
    }
  };

  const handleDownload = () => {
    if (!interviewResult) return;
    let meta: { company?: string; jobTitle?: string } = {};
    try {
      const raw = sessionStorage.getItem("jobscout:analyzeResult");
      if (raw) {
        const a = AnalysisResultSchema.parse(JSON.parse(raw));
        meta = { company: a.companyInfo.name, jobTitle: a.roleTitle };
      }
    } catch {
      // stale 캐시 무시
    }
    downloadInterviewAsTxt(interviewResult, meta);
  };

  if (!jdText) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  return (
    <AppShell
      ribbonLeft={<>면접 질문</>}
      ribbonRight={<>STATUS: {effectiveStatus.toUpperCase()}</>}
    >
      <div className="max-w-6xl mx-auto space-y-0">
        {/* 헤더 */}
        <FadeIn>
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12">
            <div>
              <span className="inline-block bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-bold mb-4">
                면접 준비
              </span>
              <h1 className="font-heading text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
                면접 예상질문
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                채용공고를 기반으로 정확히 10문항 (기술 5 · 인성 3 · 상황 2) + 면접 팁 4개를 생성합니다.
              </p>
            </div>
            {effectiveStatus === "done" && interviewResult && (
              <div className="relative w-48 h-32 flex items-center justify-center bg-muted border-4 border-foreground shrink-0">
                <div className="flex flex-col items-center">
                  <span className="font-heading text-4xl font-black italic text-secondary">
                    {interviewResult.questions.length}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                    질문 생성됨
                  </span>
                </div>
                <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-foreground" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-foreground" />
              </div>
            )}
          </div>
        </FadeIn>

        {/* ───────── 스트리밍: 스켈레톤 ───────── */}
        {(effectiveStatus === "idle" || effectiveStatus === "streaming") && (
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
                면접 질문 생성 중...
              </span>
            </div>
            <InterviewSkeleton />
          </FadeIn>
        )}

        {/* ───────── 에러 ───────── */}
        {effectiveStatus === "error" && (
          <FadeIn>
            <div className="border-l-4 border-destructive bg-card p-8 space-y-4">
              <h3 className="font-heading text-xl font-bold text-destructive">
                질문 생성에 실패했습니다
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {friendlyError(error)}
              </p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                다시 시도
              </Button>
            </div>
          </FadeIn>
        )}

        {/* ───────── 결과 ───────── */}
        {effectiveStatus === "done" && interviewResult && (
          <>
            <FadeIn>
              <div className="flex justify-end mb-6">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  면접질문 .txt
                </Button>
              </div>
            </FadeIn>
            <InterviewResultView result={interviewResult} />
          </>
        )}

        {/* 파싱 실패 */}
        {effectiveStatus === "done" && !interviewResult && fullText && (
          <FadeIn>
            <div className="border-l-4 border-accent bg-card p-8 space-y-4">
              <h3 className="font-heading text-xl font-bold text-accent">
                응답 형식이 예상과 달라요
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                서버가 JSON 스키마를 따르지 않는 응답을 반환했습니다 (카테고리 분포 5/3/2 또는 개수 10/팁 4 위반 가능성). 재시도하면 해결되는 경우가 많아요.
              </p>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">원문 보기</summary>
                <pre className="mt-2 whitespace-pre-wrap bg-muted p-3 max-h-80 overflow-auto">
                  {fullText}
                </pre>
              </details>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                다시 시도
              </Button>
            </div>
          </FadeIn>
        )}

        {/* 하단 액션 */}
        {effectiveStatus === "done" && (
          <FadeIn delay={0.09}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
              <button
                onClick={() => router.push("/match")}
                className="p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">01</span>
                <h4 className="font-heading text-lg font-bold mt-2 mb-1">프로필 매칭</h4>
                <p className="text-xs text-muted-foreground">이력서와 채용공고를 비교 분석하여 적합도를 산출합니다.</p>
              </button>
              <button
                onClick={() => router.push("/cover-letter")}
                className="p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">02</span>
                <h4 className="font-heading text-lg font-bold mt-2 mb-1">자소서 생성</h4>
                <p className="text-xs text-muted-foreground">채용공고 + 프로필 기반 맞춤형 자기소개서를 작성합니다.</p>
              </button>
            </div>
          </FadeIn>
        )}
      </div>
    </AppShell>
  );
}
