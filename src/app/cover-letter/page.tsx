"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import {
  AnalysisResultSchema,
  CoverLetterResultSchema,
  ImproveCoverLetterResultSchema,
  type CoverLetterResult,
  type ImproveCoverLetterResult,
} from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import { getActiveProfile } from "@/lib/storage/profiles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/motion";
import { FileDropZone } from "@/components/file-drop-zone";
import { AppShell } from "@/components/app-shell";
import { friendlyError } from "@/lib/utils";

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

function safeParseCoverLetter(text: string): CoverLetterResult | null {
  if (!text) return null;
  try {
    const parsed = CoverLetterResultSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function flattenCoverLetterToText(r: CoverLetterResult): string {
  return [
    `${r.companyName} · ${r.jobTitle}`,
    "",
    ...r.sections.flatMap((s) => [`## ${s.heading}`, "", ...s.paragraphs, ""]),
  ]
    .join("\n")
    .trim();
}

/* ─── 스켈레톤 ─── */
function CoverLetterSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-foreground p-1">
        <div className="px-4 py-2 flex items-center gap-2">
          <Skeleton className="h-2 w-2" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="bg-card p-8 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
          <div className="pt-4" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[75%]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
          <div className="pt-4" />
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[70%]" />
        </div>
      </div>
    </div>
  );
}

function CoverLetterView({ result }: { result: CoverLetterResult }) {
  return (
    <div className="space-y-8">
      <div className="border-b-2 border-foreground/20 pb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
          {result.companyName} · {result.jobTitle}
        </p>
      </div>
      {result.sections.map((section, i) => (
        <section key={i} className="space-y-3">
          <h2 className="font-heading text-2xl font-bold italic">
            <span className="text-secondary mr-3">{String(i + 1).padStart(2, "0")}.</span>
            {section.heading}
          </h2>
          {section.paragraphs.map((p, j) => (
            <p key={j} className="text-sm leading-relaxed whitespace-pre-line">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function CoverLetterPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const startedRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [cachedResult, setCachedResult] = useState<CoverLetterResult | null>(null);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/cover-letter");

  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);

    const activeSlot = getActiveProfile();
    if (!activeSlot) {
      router.replace("/match");
      return;
    }

    const cached = sessionStorage.getItem("jobscout:coverLetterResult");
    if (cached) {
      const parsed = safeParseCoverLetter(cached);
      if (parsed) {
        setCachedResult(parsed);
        return;
      }
      // stale 또는 구 포맷(마크다운) — 조용히 삭제 후 재생성 트리거
      sessionStorage.removeItem("jobscout:coverLetterResult");
    }

    if (!startedRef.current) {
      startedRef.current = true;
      start({ jdText: text, profile: activeSlot.profile, ...readAnalysisExtras() });
    }
  }, [router, start]);

  const liveResult = useMemo<CoverLetterResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    return safeParseCoverLetter(fullText);
  }, [status, fullText]);

  useEffect(() => {
    if (status === "done" && liveResult && !cachedResult) {
      sessionStorage.setItem(
        "jobscout:coverLetterResult",
        JSON.stringify(liveResult),
      );
    }
  }, [status, liveResult, cachedResult]);

  const effectiveStatus = cachedResult ? "done" : status;
  const effectiveResult = cachedResult ?? liveResult;

  const handleCopy = useCallback(async () => {
    if (!effectiveResult) return;
    await navigator.clipboard.writeText(flattenCoverLetterToText(effectiveResult));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [effectiveResult]);

  const handleRetry = () => {
    sessionStorage.removeItem("jobscout:coverLetterResult");
    setCachedResult(null);
    reset();
    startedRef.current = false;
    const text = sessionStorage.getItem("jobscout:jdText");
    const activeSlot = getActiveProfile();
    if (text && activeSlot) {
      startedRef.current = true;
      start({ jdText: text, profile: activeSlot.profile, ...readAnalysisExtras() });
    }
  };

  if (!jdText) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  const showSkeleton =
    (effectiveStatus === "idle" || effectiveStatus === "streaming") && !effectiveResult;
  const parseFailed =
    effectiveStatus === "done" && !effectiveResult && fullText.length > 0;

  return (
    <AppShell
      ribbonLeft={<>자소서</>}
      ribbonRight={<>STATUS: {effectiveStatus.toUpperCase()}</>}
    >
      <div className="max-w-6xl mx-auto space-y-0">
        {/* 헤더 */}
        <FadeIn>
          <div className="mb-12">
            <span className="inline-block bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-bold mb-4">
              자동 생성
            </span>
            <h1 className="font-heading text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
              자기소개서
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              채용공고와 프로필을 기반으로 맞춤형 자기소개서 초안을 작성합니다.
            </p>
          </div>
        </FadeIn>

        {/* ───────── 대기/스트리밍: 스켈레톤 ───────── */}
        {showSkeleton && (
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
                자기소개서 작성 중...
              </span>
            </div>
            <CoverLetterSkeleton />
          </FadeIn>
        )}

        {/* ───────── 결과 ───────── */}
        {effectiveResult && (
          <FadeIn>
            <div className="bg-foreground p-1 mb-12">
              <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-widest flex items-center gap-2 text-background/80">
                  <span className="w-2 h-2 bg-secondary" />
                  자기소개서 초안
                </span>
                <div className="flex gap-2">
                  <span className="w-3 h-3 bg-background/20" />
                  <span className="w-3 h-3 bg-background/20" />
                  <span className="w-3 h-3 bg-background/20" />
                </div>
              </div>
              <div className="bg-card p-8">
                <CoverLetterView result={effectiveResult} />

                <div className="mt-8 pt-6 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {effectiveResult.sections.length}개 섹션 · 작성 완료
                  </span>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? "복사됨!" : "클립보드에 복사"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                      재생성
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        {/* ───────── 파싱 실패 ───────── */}
        {parseFailed && (
          <FadeIn>
            <div className="border-l-4 border-accent bg-card p-8 space-y-4">
              <h3 className="font-heading text-xl font-bold text-accent">
                응답 형식이 예상과 달라요
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                서버가 JSON 스키마를 따르지 않는 응답을 반환했습니다. 재시도하면 해결되는 경우가 많아요.
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

        {/* ───────── 에러 ───────── */}
        {effectiveStatus === "error" && (
          <FadeIn>
            <div className="border-l-4 border-destructive bg-card p-8 space-y-4">
              <h3 className="font-heading text-xl font-bold text-destructive">
                자소서 생성에 실패했습니다
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

        {/* ───────── 기존 자소서 개선 ───────── */}
        {jdText && (
          <FadeIn delay={0.06}>
            <ImproveSection jdText={jdText} />
          </FadeIn>
        )}

        {/* 하단 액션 카드 */}
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
              onClick={() => router.push("/interview")}
              className="p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">02</span>
              <h4 className="font-heading text-lg font-bold mt-2 mb-1">면접 예상질문</h4>
              <p className="text-xs text-muted-foreground">채용공고 기반 면접 예상 질문과 모범 답안을 생성합니다.</p>
            </button>
          </div>
        </FadeIn>
      </div>
    </AppShell>
  );
}

// ─── 기존 자소서 개선 섹션 ──────────────────────────

function safeParseImprove(text: string): ImproveCoverLetterResult | null {
  if (!text) return null;
  try {
    const parsed = ImproveCoverLetterResultSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function ImproveSection({ jdText }: { jdText: string }) {
  const {
    status: improveStatus,
    fullText: improveText,
    error: improveError,
    start: startImprove,
    reset: resetImprove,
  } = useStreamingResponse<StreamEvent>("/api/improve-cover-letter");
  const [improveCopied, setImproveCopied] = useState(false);

  const improveResult = useMemo<ImproveCoverLetterResult | null>(() => {
    if (improveStatus !== "done" || !improveText) return null;
    return safeParseImprove(improveText);
  }, [improveStatus, improveText]);

  const improveParseFailed =
    improveStatus === "done" && !improveResult && improveText.length > 0;

  const handleImproveFile = useCallback(
    (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jdText", jdText);
      startImprove(formData);
    },
    [jdText, startImprove],
  );

  const handleImproveCopy = useCallback(async () => {
    if (!improveResult) return;
    await navigator.clipboard.writeText(flattenCoverLetterToText(improveResult.revised));
    setImproveCopied(true);
    setTimeout(() => setImproveCopied(false), 2000);
  }, [improveResult]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-foreground">
      {/* 좌측: 업로드 */}
      <div className="p-8 bg-muted/30 border-r-0 md:border-r-2 border-border">
        <h2 className="font-heading text-2xl font-bold italic mb-2">
          기존 자소서 첨삭
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          이미 작성한 자소서가 있다면 파일을 업로드하여 채용공고 기반 개선 제안을 받아보세요.
        </p>

        {improveStatus === "idle" && (
          <FileDropZone
            accept=".pdf,.docx,.txt"
            label="기존 자소서를 드래그하세요"
            description="PDF, DOCX, TXT (5MB 이하)"
            onFile={handleImproveFile}
          />
        )}

        {improveStatus === "streaming" && (
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              자소서 분석 및 개선 제안 작성 중...
            </span>
          </div>
        )}

        {improveStatus === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {improveError ?? "자소서 개선 중 오류가 발생했습니다"}
            </p>
            <Button variant="outline" size="sm" onClick={resetImprove}>
              다시 시도
            </Button>
          </div>
        )}
      </div>

      {/* 우측: 개선 결과 */}
      <div className="p-8 bg-muted relative">
        <h2 className="font-heading text-2xl font-bold italic mb-2">
          개선 제안
        </h2>
        {!improveText && improveStatus !== "streaming" && (
          <p className="text-sm text-muted-foreground">
            자소서를 업로드하면 개선 제안이 여기에 표시됩니다.
          </p>
        )}

        {improveResult && (
          <div className="space-y-6">
            <section className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
                총평
              </p>
              <p className="text-sm leading-relaxed">{improveResult.overallComment}</p>
            </section>

            {improveResult.suggestions.length > 0 && (
              <section className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
                  수정 제안 ({improveResult.suggestions.length})
                </p>
                <div className="space-y-3">
                  {improveResult.suggestions.map((s, i) => (
                    <div key={i} className="border-l-4 border-foreground/20 pl-4 py-2 bg-card">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {s.heading}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold">원문:</span> {s.original}
                      </p>
                      <p className="text-xs mt-1">
                        <span className="font-semibold text-secondary">수정:</span> {s.revised}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 italic">
                        → {s.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {improveResult.missingFromJd.length > 0 && (
              <section className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
                  JD에 있으나 자소서에 빠진 요소
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {improveResult.missingFromJd.map((m, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-accent/20 text-accent-foreground px-2 py-1 uppercase tracking-wider"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
                수정된 전체 자소서
              </p>
              <div className="bg-card p-4 border border-border/40">
                <CoverLetterView result={improveResult.revised} />
              </div>
            </section>

            <div className="flex gap-2 pt-3 border-t border-border/30">
              <Button variant="outline" size="sm" onClick={handleImproveCopy}>
                {improveCopied ? "복사됨!" : "수정본 복사"}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetImprove}>
                다른 자소서 개선
              </Button>
            </div>
          </div>
        )}

        {improveParseFailed && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              개선 결과를 해석하지 못했습니다. 다시 시도해보세요.
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">원문 보기</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-card p-3 max-h-80 overflow-auto">
                {improveText}
              </pre>
            </details>
            <Button variant="outline" size="sm" onClick={resetImprove}>
              다시 시도
            </Button>
          </div>
        )}

        <div className="absolute bottom-8 right-8 opacity-[0.03] select-none pointer-events-none">
          <span className="font-heading italic font-black text-7xl">EDIT</span>
        </div>
      </div>
    </div>
  );
}
