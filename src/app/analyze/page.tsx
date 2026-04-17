"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { extractJson } from "@/lib/prompts/analyze";
import type { AnalysisResult, Skill } from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";
import { AppShell } from "@/components/app-shell";
import { friendlyError } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";

interface CrawlMeta {
  title: string;
  company: string;
  url: string;
}

/* ─── 스킬 뱃지 ─── */
function SkillBadge({ skill }: { skill: Skill }) {
  const variant =
    skill.category === "required"
      ? "default"
      : skill.category === "preferred"
        ? "secondary"
        : "outline";

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={variant} className="cursor-default">
          {skill.name}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{skill.context}</p>
        {skill.level !== "unspecified" && (
          <p className="text-xs text-muted-foreground mt-1">
            요구 수준: {skill.level}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── 스탯 박스 (레퍼런스 82% 링 패턴) ─── */
function StatsBox({ skills }: { skills: Skill[] }) {
  const required = skills.filter((s) => s.category === "required").length;
  const total = skills.length;

  return (
    <div className="relative w-48 h-48 flex items-center justify-center bg-muted border-4 border-foreground shrink-0">
      <div className="flex flex-col items-center">
        <span className="font-heading text-6xl font-black italic text-secondary">
          {total}
        </span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
          기술 스택
        </span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">
          필수 {required}개
        </span>
      </div>
      {/* Pixel corner accents */}
      <div className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 bg-foreground" />
      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-foreground" />
    </div>
  );
}

/* ─── 스트리밍 스켈레톤 ─── */
function AnalysisSkeleton() {
  return (
    <div className="space-y-0 animate-pulse">
      {/* 히어로 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12 pb-8">
        <div className="w-full md:w-2/3">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-14 w-[80%] mb-3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4 mt-2" />
        </div>
        <div className="w-40 h-40 bg-muted border-4 border-foreground/20 flex items-center justify-center shrink-0">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* 좌우 대비 패널 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-foreground/20 mb-12">
        <div className="p-8 bg-muted/50 space-y-6">
          <Skeleton className="h-6 w-40 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 bg-card border-l-4 border-border space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-8 bg-muted space-y-6">
          <Skeleton className="h-6 w-40 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 bg-card/50 border-l-4 border-foreground/20 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 다크 프레임 섹션 */}
      <div className="bg-foreground p-1 mb-12">
        <div className="px-4 py-2 flex items-center gap-2">
          <Skeleton className="h-2 w-2" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="bg-card p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 액션 */}
      <div className="flex justify-center">
        <Skeleton className="h-14 w-64" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  메인 페이지                                           */
/* ═══════════════════════════════════════════════════════ */

export default function AnalyzePage() {
  const router = useRouter();
  const [crawlMeta, setCrawlMeta] = useState<CrawlMeta | null>(null);
  const [jdText, setJdText] = useState<string | null>(null);
  const [cachedResult, setCachedResult] = useState<AnalysisResult | null>(null);
  const startedRef = useRef(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/analyze");

  /* ─── URL/텍스트 입력 상태 (jdText 없을 때) ─── */
  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<"idle" | "loading" | "error">("idle");
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const startAnalysis = useCallback(
    (text: string, meta?: CrawlMeta) => {
      sessionStorage.removeItem("jobscout:analyzeResult");
      sessionStorage.removeItem("jobscout:coverLetterResult");
      sessionStorage.removeItem("jobscout:interviewResult");
      sessionStorage.setItem("jobscout:jdText", text);
      if (meta) {
        sessionStorage.setItem("jobscout:crawlMeta", JSON.stringify(meta));
        setCrawlMeta(meta);
      } else {
        sessionStorage.removeItem("jobscout:crawlMeta");
        setCrawlMeta(null);
      }
      setJdText(text);
      setCachedResult(null);
      reset();
      startedRef.current = true;
      start({ text });
    },
    [start, reset],
  );

  const handleUrlSubmit = useCallback(async () => {
    if (!urlInput.trim()) return;
    setCrawlStatus("loading");
    setCrawlError(null);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error);
      }
      const data = (await res.json()) as { title: string; company: string; text: string; url: string };
      setCrawlStatus("idle");
      startAnalysis(data.text, { title: data.title, company: data.company, url: data.url });
    } catch (err) {
      setCrawlStatus("error");
      setCrawlError(err instanceof Error ? err.message : "크롤링 중 오류가 발생했습니다");
    }
  }, [urlInput, startAnalysis]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim() || textInput.trim().length < 50) return;
    startAnalysis(textInput.trim());
  }, [textInput, startAnalysis]);

  const handleReset = () => {
    sessionStorage.removeItem("jobscout:jdText");
    sessionStorage.removeItem("jobscout:crawlMeta");
    sessionStorage.removeItem("jobscout:analyzeResult");
    sessionStorage.removeItem("jobscout:coverLetterResult");
    sessionStorage.removeItem("jobscout:interviewResult");
    setJdText(null);
    setCrawlMeta(null);
    setCachedResult(null);
    reset();
    startedRef.current = false;
    setUrlInput("");
    setTextInput("");
    setCrawlStatus("idle");
    setCrawlError(null);
  };

  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) return;
    setJdText(text);

    const metaStr = sessionStorage.getItem("jobscout:crawlMeta");
    if (metaStr) {
      setCrawlMeta(JSON.parse(metaStr) as CrawlMeta);
    }

    // 캐시된 결과가 있으면 재분석 스킵
    const cached = sessionStorage.getItem("jobscout:analyzeResult");
    if (cached) {
      try {
        setCachedResult(JSON.parse(cached) as AnalysisResult);
        return;
      } catch { /* 파싱 실패 시 재분석 */ }
    }

    if (!startedRef.current) {
      startedRef.current = true;
      start({ text });
    }
  }, [router, start]);

  const analysisResult = useMemo<AnalysisResult | null>(() => {
    if (cachedResult) return cachedResult;
    if (status !== "done" || !fullText) return null;
    try {
      return extractJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText, cachedResult]);

  // 분석 완료 시 결과 캐싱
  useEffect(() => {
    if (status === "done" && analysisResult && !cachedResult) {
      sessionStorage.setItem("jobscout:analyzeResult", JSON.stringify(analysisResult));
    }
  }, [status, analysisResult, cachedResult]);

  const handleRetry = () => {
    sessionStorage.removeItem("jobscout:analyzeResult");
    setCachedResult(null);
    reset();
    startedRef.current = false;
    const text = sessionStorage.getItem("jobscout:jdText");
    if (text) {
      startedRef.current = true;
      start({ text });
    }
  };

  /* ─── 유효 상태: 캐시 결과가 있으면 "done" 취급 ─── */
  const effectiveStatus = cachedResult ? "done" : status;

  /* ─── 스킬 분류 (결과 있을 때만) ─── */
  const required = analysisResult?.skills.filter((s) => s.category === "required") ?? [];
  const preferred = analysisResult?.skills.filter((s) => s.category === "preferred") ?? [];
  const etc = analysisResult?.skills.filter((s) => s.category === "etc") ?? [];

  /* ─── jdText 없을 때: 입력 폼 ─── */
  if (!jdText) {
    return (
      <AppShell ribbonLeft={<>채용공고 분석</>} ribbonRight={<>대기 중</>}>
        <div className="max-w-4xl mx-auto space-y-8">
          <FadeIn>
            <div className="dot-matrix-texture p-8 border-2 border-primary/10">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-secondary" />
                <span className="text-xs text-secondary uppercase tracking-[0.2em] font-bold">
                  채용공고 입력
                </span>
              </div>
              <h1 className="font-heading text-5xl md:text-6xl text-primary font-black tracking-tighter leading-none mb-3">
                분석할 공고를 입력하세요
              </h1>
              <p className="text-muted-foreground text-lg">
                URL을 입력하거나 채용공고 텍스트를 직접 붙여넣으세요.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "url" | "text")}>
              <TabsList className="bg-card p-0.5 flex mb-6 w-full">
                <TabsTrigger value="url" className="flex-1 py-4 data-active:bg-primary data-active:text-primary-foreground">
                  URL 입력
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1 py-4 data-active:bg-primary data-active:text-primary-foreground">
                  텍스트 직접 입력
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <input
                  className="w-full bg-transparent border-b-2 border-primary/20 focus:border-secondary outline-none py-4 text-lg placeholder:text-primary/20 transition-colors"
                  placeholder="https://www.wanted.co.kr/wd/123456"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                  disabled={crawlStatus === "loading"}
                />
                {crawlStatus === "loading" && (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <p className="text-sm text-muted-foreground mt-2">채용공고를 가져오는 중...</p>
                  </div>
                )}
                {crawlStatus === "error" && crawlError && (
                  <div className="border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
                    <p className="text-destructive font-medium">{crawlError}</p>
                    <button className="mt-2 underline text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setInputMode("text")}>
                      텍스트로 직접 입력하기
                    </button>
                  </div>
                )}
                <button
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim() || crawlStatus === "loading"}
                  className="w-full bg-secondary text-secondary-foreground py-5 text-lg uppercase tracking-[0.2em] font-medium hover:bg-secondary/90 transition-colors flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {crawlStatus === "loading" ? "가져오는 중..." : "분석 시작"}
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </button>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="pixel-dashed-border p-1">
                  <Textarea
                    placeholder="채용공고 텍스트를 붙여넣으세요 (최소 50자)"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={12}
                    className="resize-y border-none min-h-[280px]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {textInput.length}자
                    {textInput.length > 0 && textInput.length < 50 && (
                      <span className="text-destructive ml-1">(최소 50자)</span>
                    )}
                  </span>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim() || textInput.trim().length < 50}
                    className="bg-secondary text-secondary-foreground px-8 py-3 text-sm uppercase tracking-widest font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    분석 시작
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </FadeIn>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      ribbonLeft={<>채용공고 분석</>}
      ribbonRight={<>STATUS: {effectiveStatus.toUpperCase()}</>}
    >
      <div className="max-w-6xl mx-auto space-y-0">
        {/* ───────── 스트리밍 중: 스켈레톤 ───────── */}
        {(effectiveStatus === "idle" || effectiveStatus === "streaming") && (
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
                {crawlMeta?.title
                  ? `${crawlMeta.title} 분석 중`
                  : "채용공고 분석 중"}
                ...
              </span>
            </div>
            <AnalysisSkeleton />
          </FadeIn>
        )}

        {/* ───────── 에러 ───────── */}
        {effectiveStatus === "error" && (
          <FadeIn>
            <div className="border-l-4 border-destructive bg-card p-8 space-y-4">
              <h3 className="font-heading text-xl font-bold text-destructive">
                분석에 실패했습니다
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {friendlyError(error)}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  새 공고 분석
                </Button>
              </div>
            </div>
          </FadeIn>
        )}

        {/* ───────── 분석 완료 ───────── */}
        {effectiveStatus === "done" && analysisResult && (
          <>
            {/* ▸ 히어로 헤더 — 레퍼런스 Comparison Matrix 패턴 */}
            <FadeIn>
              <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12">
                <div className="w-full md:w-2/3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                    <span className="inline-block bg-secondary text-secondary-foreground px-5 py-2.5 text-sm uppercase tracking-[0.2em] font-bold">
                      채용공고 분석 결과
                    </span>
                    <button
                      onClick={handleReset}
                      className="bg-muted border-2 border-primary/20 hover:border-secondary px-5 py-2.5 text-sm uppercase tracking-widest text-primary hover:text-secondary font-bold transition-all duration-75 hover:-translate-y-0.5"
                    >
                      새 공고 분석 →
                    </button>
                  </div>
                  <h1 className="font-heading text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
                    {analysisResult.roleTitle}
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                    {analysisResult.summary}
                  </p>
                </div>
                <StatsBox skills={analysisResult.skills} />
              </div>
            </FadeIn>

            {/* ▸ 좌우 대비 패널 — 레퍼런스 side-by-side 패턴 */}
            <FadeIn delay={0.03}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-12 border-t-4 border-foreground">
                {/* 좌측: 주요 업무 */}
                <div className="p-8 border-r-0 md:border-r-2 border-border bg-muted/30 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="font-heading text-2xl font-bold italic">
                        주요 업무
                      </h2>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        핵심 직무 요구사항
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {analysisResult.keyResponsibilities.map((r, i) => (
                      <div
                        key={i}
                        className="p-4 bg-card border-l-4 border-secondary/40"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase text-secondary">
                            업무 {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{r}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 우측: 회사 정보 */}
                <div className="p-8 bg-muted relative">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="font-heading text-2xl font-bold italic">
                        회사 프로필
                      </h2>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        기업 정보 요약
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-card/60 border-l-4 border-foreground">
                      <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                        회사명
                      </div>
                      <p className="font-heading text-lg font-bold italic">
                        {analysisResult.companyInfo.name}
                      </p>
                    </div>
                    {analysisResult.companyInfo.industry && (
                      <div className="p-4 bg-card/60 border-l-4 border-foreground">
                        <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                          업종
                        </div>
                        <p className="text-sm">{analysisResult.companyInfo.industry}</p>
                      </div>
                    )}
                    {analysisResult.companyInfo.size && (
                      <div className="p-4 bg-card/60 border-l-4 border-foreground">
                        <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                          규모
                        </div>
                        <p className="text-sm">{analysisResult.companyInfo.size}</p>
                      </div>
                    )}
                    {analysisResult.experienceLevel && (
                      <div className="p-4 bg-card/60 border-l-4 border-foreground">
                        <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                          경력 요구
                        </div>
                        <p className="text-sm">{analysisResult.experienceLevel}</p>
                      </div>
                    )}
                  </div>
                  {/* 워터마크 데코 */}
                  <div className="absolute bottom-8 right-8 opacity-[0.03] select-none pointer-events-none">
                    <span className="font-heading italic font-black text-8xl">
                      SCOUT
                    </span>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* ▸ 자격요건 / 우대사항 — 원문 문장 보존 */}
            {(analysisResult.requirements.length > 0 ||
              analysisResult.preferredRequirements.length > 0) && (
              <FadeIn delay={0.04}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-12 border-t-2 border-foreground">
                  {analysisResult.requirements.length > 0 && (
                    <div className="p-8 border-r-0 md:border-r-2 border-border bg-muted/20">
                      <div className="mb-6">
                        <h2 className="font-heading text-2xl font-bold italic">
                          자격요건
                        </h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          필수 지원 조건
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {analysisResult.requirements.map((r, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                            <span className="text-[10px] font-bold text-secondary mt-1 shrink-0 tracking-widest">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisResult.preferredRequirements.length > 0 && (
                    <div className="p-8 bg-card">
                      <div className="mb-6">
                        <h2 className="font-heading text-2xl font-bold italic">
                          우대사항
                        </h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          있으면 좋은 조건
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {analysisResult.preferredRequirements.map((r, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                            <span className="text-[10px] font-bold text-accent mt-1 shrink-0 tracking-widest">
                              +{String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </FadeIn>
            )}

            {/* ▸ 기술 스택 — 레퍼런스 Editorial Suggestions 다크 프레임 패턴 */}
            <FadeIn delay={0.06}>
              <div className="bg-foreground p-1 mb-12">
                <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest flex items-center gap-2 text-background/80">
                    <span className="w-2 h-2 bg-secondary" />
                    기술 스택 분석
                  </span>
                  <div className="flex gap-2">
                    <span className="w-3 h-3 bg-background/20" />
                    <span className="w-3 h-3 bg-background/20" />
                    <span className="w-3 h-3 bg-background/20" />
                  </div>
                </div>
                <div className="bg-card p-8 dot-matrix-texture">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* 필수 스킬 */}
                    {required.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-heading font-bold text-lg border-b-2 border-secondary pb-1 inline-block">
                          필수 스킬
                        </h4>
                        <StaggerList className="flex flex-wrap gap-2">
                          {required.map((s) => (
                            <StaggerItem key={s.name}>
                              <SkillBadge skill={s} />
                            </StaggerItem>
                          ))}
                        </StaggerList>
                      </div>
                    )}
                    {/* 우대 스킬 */}
                    {preferred.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-heading font-bold text-lg border-b-2 border-secondary pb-1 inline-block">
                          우대 스킬
                        </h4>
                        <StaggerList className="flex flex-wrap gap-2">
                          {preferred.map((s) => (
                            <StaggerItem key={s.name}>
                              <SkillBadge skill={s} />
                            </StaggerItem>
                          ))}
                        </StaggerList>
                      </div>
                    )}
                    {/* 기타 스킬 */}
                    {etc.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-heading font-bold text-lg border-b-2 border-secondary pb-1 inline-block">
                          기타
                        </h4>
                        <StaggerList className="flex flex-wrap gap-2">
                          {etc.map((s) => (
                            <StaggerItem key={s.name}>
                              <SkillBadge skill={s} />
                            </StaggerItem>
                          ))}
                        </StaggerList>
                      </div>
                    )}
                  </div>

                  {/* 복리후생 (있으면) */}
                  {analysisResult.benefits.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-border/30">
                      <h4 className="font-heading font-bold text-lg border-b-2 border-secondary pb-1 inline-block mb-4">
                        복리후생
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                        {analysisResult.benefits.map((b, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="text-accent mt-0.5 shrink-0">
                              ●
                            </span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 문화 뱃지 */}
                  {analysisResult.companyInfo.culture.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-border/30">
                      <h4 className="font-heading font-bold text-lg border-b-2 border-secondary pb-1 inline-block mb-4">
                        기업 문화
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.companyInfo.culture.map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="text-xs"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA 버튼 — 레퍼런스 APPLY AMENDMENTS 패턴 */}
                  <div className="mt-12 flex justify-center">
                    <Button
                      onClick={() => router.push("/match")}
                      className="bg-secondary text-secondary-foreground px-10 py-6 text-sm uppercase tracking-[0.3em] font-bold hover:bg-foreground hover:text-background transition-colors duration-75 h-auto"
                    >
                      프로필 매칭 시작
                      <span className="ml-3">→</span>
                    </Button>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* ▸ 하단 액션 카드 3열 */}
            <FadeIn delay={0.09}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => router.push("/match")}
                  className="group p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    01
                  </span>
                  <h4 className="font-heading text-lg font-bold mt-2 mb-1">
                    프로필 매칭
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    이력서와 채용공고를 비교 분석하여 적합도 점수를 산출합니다.
                  </p>
                </button>
                <button
                  onClick={() => router.push("/cover-letter")}
                  className="group p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    02
                  </span>
                  <h4 className="font-heading text-lg font-bold mt-2 mb-1">
                    자소서 생성
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    채용공고 맞춤형 자기소개서 초안을 AI가 작성합니다.
                  </p>
                </button>
                <button
                  onClick={() => router.push("/interview")}
                  className="group p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                    03
                  </span>
                  <h4 className="font-heading text-lg font-bold mt-2 mb-1">
                    면접 예상질문
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    채용공고 기반 면접 예상 질문과 모범 답안을 생성합니다.
                  </p>
                </button>
              </div>
            </FadeIn>
          </>
        )}

        {/* 파싱 실패 fallback */}
        {effectiveStatus === "done" && !analysisResult && fullText && (
          <FadeIn>
            <div className="stepped-pixel-border bg-card p-6">
              <p className="text-[10px] uppercase tracking-[0.3em] text-secondary font-bold mb-3">
                원문 출력
              </p>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 dot-matrix-texture">
                {fullText}
              </pre>
            </div>
          </FadeIn>
        )}

        {/* 빈 응답 (서버 과부하 등) */}
        {effectiveStatus === "done" && !analysisResult && !fullText && (
          <FadeIn>
            <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
              <p className="text-sm text-destructive font-medium">
                AI 서버가 응답하지 않았습니다. 잠시 후 다시 시도해주세요.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  새 공고 분석
                </Button>
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    </AppShell>
  );
}
