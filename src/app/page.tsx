"use client";

import { useState, useCallback } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { getJobKey } from "@/lib/storage/job-index";
import { Tabs, TabsList, TabsTrigger, TabsContent } from"@/components/ui/tabs";
import { Textarea } from"@/components/ui/textarea";
import { Button } from"@/components/ui/button";
import { FadeIn } from"@/components/motion";
import { AnalysisProgress } from "@/components/analyze/AnalysisProgress";
import { PositionPicker } from "@/components/analyze/PositionPicker";
import { AppShell } from "@/components/app-shell";
import { Search, Target, FileText, MessageCircle } from"lucide-react";

interface CrawlMeta {
  title: string;
  company: string;
  url: string;
}

export default function HomePage() {
 const router = useRouter();

 const [inputMode, setInputMode] = useState<"url" |"text">("url");
 const [url, setUrl] = useState("");
 const [jdText, setJdText] = useState("");
 const [crawlStatus, setCrawlStatus] = useState<
"idle" |"loading" |"error"
 >("idle");
 const [crawlError, setCrawlError] = useState<string | null>(null);
 const [pendingCrawl, setPendingCrawl] = useState<{
  text: string;
  positions: string[];
  meta: CrawlMeta;
 } | null>(null);

 const goToAnalyze = useCallback(
 (text: string, meta?: CrawlMeta, focusPosition?: string) => {
 // 새 분석 시 이전 캐시 전부 클리어
 sessionStorage.removeItem("jobscout:analyzeResult");
 sessionStorage.removeItem("jobscout:coverLetterResult");
 sessionStorage.removeItem("jobscout:interviewResult");
 sessionStorage.setItem("jobscout:jdText", text);
 if (meta) {
 sessionStorage.setItem("jobscout:crawlMeta", JSON.stringify(meta));
 } else {
 sessionStorage.removeItem("jobscout:crawlMeta");
 }
 if (focusPosition) {
 sessionStorage.setItem("jobscout:focusPosition", focusPosition);
 } else {
 sessionStorage.removeItem("jobscout:focusPosition");
 }
 router.push(`/jobs/${getJobKey(text, focusPosition)}?tab=analyze&autostart=1`);
 },
 [router],
 );

 const handleUrlSubmit = useCallback(async () => {
 if (!url.trim()) return;

 setCrawlStatus("loading");
 setCrawlError(null);

 try {
 const res = await fetch("/api/crawl", {
 method:"POST",
 headers: {"Content-Type":"application/json" },
 body: JSON.stringify({ url: url.trim() }),
 });

 if (!res.ok) {
 const data = (await res.json()) as { error: string };
 throw new Error(data.error);
 }

 const data = (await res.json()) as {
 title: string;
 company: string;
 text: string;
 url: string;
 positions?: string[];
 };
 setCrawlStatus("idle");
 const meta: CrawlMeta = { title: data.title, company: data.company, url: data.url };
 const positions = data.positions ?? [];
 if (positions.length === 1) {
 // 단일 포지션 → 바로 분석
 goToAnalyze(data.text, meta);
 } else {
 // 0개(감지 실패) 또는 2개 이상(다중) → 피커 화면으로
 setPendingCrawl({ text: data.text, positions, meta });
 }
 } catch (err) {
 setCrawlStatus("error");
 setCrawlError(
 err instanceof Error
 ? err.message
 :"크롤링 중 오류가 발생했습니다",
 );
 }
 }, [url, goToAnalyze]);

 const handleTextSubmit = useCallback(() => {
 if (!jdText.trim() || jdText.trim().length < 50) return;
 goToAnalyze(jdText.trim());
 }, [jdText, goToAnalyze]);

 const handlePositionSelect = useCallback(
 (position: string | null) => {
 if (!pendingCrawl) return;
 goToAnalyze(pendingCrawl.text, pendingCrawl.meta, position ?? undefined);
 },
 [pendingCrawl, goToAnalyze],
 );

 // 크롤링 중: 프로세스 페이지 표시
 if (crawlStatus ==="loading" && !pendingCrawl) {
 return (
 <AppShell ribbonLeft={<>채용공고 수집</>} ribbonRight={<>STATUS: CRAWLING</>}>
 <div className="max-w-6xl mx-auto">
 <FadeIn>
 <AnalysisProgress inputMode="url" deltaChars={0} phase="crawling" />
 </FadeIn>
 </div>
 </AppShell>
 );
 }

 // 크롤 완료 후 다중 포지션 피커 화면
 if (pendingCrawl) {
 return (
 <AppShell
 ribbonLeft={<>포지션 선택</>}
 ribbonRight={
 pendingCrawl.positions.length > 0
 ? <>{pendingCrawl.positions.length}개 포지션 감지</>
 : <>포지션 자동 감지 실패</>
 }
 >
 <PositionPicker
 meta={pendingCrawl.meta}
 positions={pendingCrawl.positions}
 onSelect={handlePositionSelect}
 onCancel={() => setPendingCrawl(null)}
 />
 </AppShell>
 );
 }

 return (
 <main className="flex min-h-screen flex-col bg-background">
 {/* ───── Top Navigation ───── */}
 <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b-2 border-dashed border-input flex items-center justify-between px-6 sm:px-8 py-4">
 <Link
 href="/"
 className=" text-2xl font-black text-accent"
 >
 JobScout
 </Link>
 <nav className="hidden md:flex gap-8 items-center">
 <button
 onClick={() =>
 document
 .getElementById("features")
 ?.scrollIntoView({ behavior:"smooth" })
 }
 className="text-accent border-b-2 border-secondary pb-1 text-sm font-medium"
 >
 분석 도구
 </button>
 <button
 onClick={() =>
 document
 .getElementById("input-section")
 ?.scrollIntoView({ behavior:"smooth" })
 }
 className="text-primary hover:text-accent transition-colors duration-100 text-sm font-medium"
 >
 분석하기
 </button>
 <Link
 href="/jobs"
 className="text-primary hover:text-accent transition-colors duration-100 text-sm font-medium"
 >
 내 공고
 </Link>
 </nav>
 <Button
 className="px-6 py-2 text-sm"
 onClick={() => router.push("/login")}
 >
 시작하기
 </Button>
 </header>

 {/* ───── Hero Section ───── */}
 <section className="relative min-h-[820px] flex flex-col justify-center items-center px-8 pt-24 overflow-hidden">
 {/* Background watermark */}
 <div className="absolute top-10 right-10 opacity-[0.04] select-none pointer-events-none hidden lg:block">
 <span className="text-[200px] font-black">01</span>
 </div>

 <FadeIn className="z-10 text-center max-w-4xl space-y-6">
 {/* Status badge */}
 <span className="inline-block bg-accent text-accent-foreground px-3 py-1 text-sm mb-4">
 AI 채용공고 분석기
 </span>

 {/* Main title */}
 <h1 className=" text-7xl md:text-8xl text-primary leading-tight font-black tracking-tighter">
 합격을
 <br />
 <span className=" text-accent">설계합니다</span>
 </h1>

 {/* Subtitle */}
 <p className="text-muted-foreground text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
 채용공고 URL 하나로 스킬 분석, 프로필 매칭, 자소서 초안,
 면접 예상질문까지 한번에 준비하세요.
 </p>

 {/* CTA Button with offset border effect */}
 <div className="pt-8">
 <button
 onClick={() => router.push("/login")}
 className="relative group bg-primary text-primary-foreground px-10 py-4 text-lg font-medium hover:bg-primary/90 transition-colors"
 >
 입장하기
 <div className="absolute inset-0 border-2 border-primary translate-x-2 translate-y-2 -z-10 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
 </button>
 </div>
 </FadeIn>
 </section>

 {/* ───── Analysis Tools — Bento Grid ───── */}
 <section id="features" className="py-24 px-6 sm:px-8 max-w-7xl mx-auto">
 <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
 {/* 스킬 분석 — 7 col, light */}
 <Link
 href="/login"
 className="md:col-span-7 bg-card p-10 border-2 border-border hover:border-secondary/50 transition-colors group"
 >
 <div className="flex justify-between items-start mb-12">
 <Search className="w-9 h-9 text-accent" />
 <span className="text-xs uppercase text-muted-foreground tracking-widest">
 MODULE_001
 </span>
 </div>
 <h3 className=" text-4xl text-primary mb-4">
 스킬 분석
 </h3>
 <p className="text-muted-foreground max-w-md mb-8">
 채용공고에서 필수/우대 기술 스택을 자동으로 추출하고, 각 스킬의
 맥락과 요구 수준을 정밀하게 파악합니다.
 </p>
 <div className="h-1 bg-muted w-full group-hover:bg-accent transition-colors" />
 </Link>

 {/* 프로필 매칭 — 5 col, dark */}
 <Link
 href="/login"
 className="md:col-span-5 bg-primary text-primary-foreground p-10 flex flex-col justify-between group"
 >
 <div>
 <Target className="w-9 h-9 text-accent mb-8" />
 <h3 className=" text-4xl mb-4">프로필 매칭</h3>
 <p className="text-primary-foreground/60">
 내 이력서와 채용공고를 비교 분석하여 적합도 점수, 강점,
 보완점을 한눈에 파악합니다.
 </p>
 </div>
 <div className="mt-8 text-accent text-sm tracking-widest flex items-center gap-2 group-hover:translate-x-1 transition-transform">
 매칭 분석하기 →
 </div>
 </Link>

 {/* 자소서 초안 — 5 col, surface */}
 <Link
 href="/login"
 className="md:col-span-5 bg-muted p-10 border-2 border-primary/5 group"
 >
 <FileText className="w-9 h-9 text-primary mb-8" />
 <h3 className=" text-4xl text-primary mb-4">
 자소서 초안
 </h3>
 <p className="text-muted-foreground">
 채용공고와 내 프로필을 기반으로 맞춤형 자기소개서 초안을 AI가
 자동으로 생성합니다.
 </p>
 </Link>

 {/* 면접 예상질문 — 7 col, white */}
 <Link
 href="/login"
 className="md:col-span-7 bg-card p-10 border-2 border-border relative overflow-hidden group"
 >
 <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 -rotate-45 translate-x-12 -translate-y-12" />
 <MessageCircle className="w-9 h-9 text-accent mb-8" />
 <h3 className=" text-4xl text-primary mb-4">
 면접 예상질문
 </h3>
 <p className="text-muted-foreground max-w-md">
 기술/인성/상황 별 예상 질문과 모범 답변을 생성하여 면접
 준비를 도와드립니다.
 </p>
 </Link>
 </div>
 </section>

 {/* ───── Input Section ───── */}
 <section
 id="input-section"
 className="py-24 bg-muted border-y-2 border-dashed border-input"
 >
 <div className="max-w-4xl mx-auto px-6 sm:px-8">
 {/* Section header — centered */}
 <div className="mb-12 text-center">
 <h2 className=" text-5xl text-primary mb-4">
 채용공고 입력하기
 </h2>
 <p className="text-sm text-accent">
 URL을 입력하거나 텍스트를 직접 붙여넣으세요
 </p>
 </div>

 {/* Tab buttons */}
 <Tabs
 value={inputMode}
 onValueChange={(v) => setInputMode(v as"url" |"text")}
 >
 <TabsList className="flex mb-8 w-full">
 <TabsTrigger
 value="url"
 className="flex-1 py-3 text-base"
 >
 URL 입력
 </TabsTrigger>
 <TabsTrigger
 value="text"
 className="flex-1 py-3 text-base"
 >
 텍스트 직접 입력
 </TabsTrigger>
 </TabsList>

 {/* URL Tab */}
 <TabsContent value="url" className="space-y-6">
 <div>
 <label className="block text-xs text-accent mb-2 font-medium">
 채용공고 URL
 </label>
 <input
 className="w-full bg-transparent border-b-2 border-input focus:border-secondary outline-none py-4 text-lg placeholder:text-muted-foreground transition-colors"
 placeholder="https://www.wanted.co.kr/wd/123456"
 value={url}
 onChange={(e) => setUrl(e.target.value)}
 onKeyDown={(e) =>
 e.key ==="Enter" && handleUrlSubmit()
 }
 disabled={crawlStatus ==="loading"}
 />
 </div>

 {crawlStatus ==="error" && crawlError && (
 <div className="border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
 <p className="text-destructive font-medium">
 {crawlError}
 </p>
 <button
 className="mt-2 underline text-xs text-muted-foreground hover:text-foreground transition-colors"
 onClick={() => setInputMode("text")}
 >
 텍스트로 직접 입력하기
 </button>
 </div>
 )}

 <button
 onClick={handleUrlSubmit}
 disabled={!url.trim() || crawlStatus ==="loading"}
 className="w-full bg-accent text-accent-foreground py-6 text-xl font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {crawlStatus ==="loading"
 ?"가져오는 중..."
 :"분석 시작"}
 <span className="group-hover:translate-x-2 transition-transform">
 →
 </span>
 </button>
 </TabsContent>

 {/* Text Tab */}
 <TabsContent value="text" className="space-y-6">
 <div className=" p-1">
 <Textarea
 placeholder="채용공고 텍스트를 붙여넣으세요 (최소 50자)"
 value={jdText}
 onChange={(e) => setJdText(e.target.value)}
 rows={12}
 className="resize-y border-none min-h-[280px]"
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-muted-foreground">
 {jdText.length}자
 {jdText.length > 0 && jdText.length < 50 && (
 <span className="text-destructive ml-1">
 (최소 50자)
 </span>
 )}
 </span>
 <button
 onClick={handleTextSubmit}
 disabled={
 !jdText.trim() || jdText.trim().length < 50
 }
 className="bg-accent text-accent-foreground px-8 py-3 text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 분석 시작
 </button>
 </div>
 </TabsContent>
 </Tabs>
 </div>
 </section>

 {/* ───── Bottom CTA ───── */}
 <section className="py-32 px-8 text-center bg-background overflow-hidden">
 <div className="max-w-3xl mx-auto relative">
 {/* Watermark */}
 <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[120px] text-primary/[0.04] select-none pointer-events-none font-black hidden sm:block">
 READY?
 </div>
 <h2 className=" text-5xl sm:text-6xl text-primary mb-8 relative z-10">
 취업 준비, AI와 함께
 </h2>
 <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
 채용공고 하나로 스킬 분석부터 면접 준비까지.
 JobScout이 취업 여정을 함께합니다.
 </p>
 <div className="flex flex-col items-center gap-6">
 <button
 onClick={() => router.push("/login")}
 className="bg-primary text-primary-foreground px-12 py-5 text-lg font-medium hover:scale-[1.02] transition-transform flex items-center gap-3"
 >
 지금 시작하기
 </button>
 </div>
 </div>
 </section>

 {/* ───── Metadata Ribbon ───── */}
 <div className="w-full bg-accent py-2 px-8 flex justify-between items-center text-accent-foreground text-[10px] tracking-widest uppercase">
 <span>JobScout v1.0</span>
 <span>AI 채용공고 분석기</span>
 </div>

 {/* ───── Footer ───── */}
 <footer className="w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-muted border-t-2 border-primary">
 <span className="text-[10px] text-primary/60">
 © 2026 JobScout. All rights reserved.
 </span>
 <div className="flex gap-8">
 <Link
 href="/jobs"
 className="text-xs uppercase text-primary/60 hover:text-accent transition-colors"
 >
 내 공고
 </Link>
 <Link
 href="/profiles"
 className="text-xs uppercase text-primary/60 hover:text-accent transition-colors"
 >
 프로필
 </Link>
 <Link
 href="/settings"
 className="text-xs uppercase text-primary/60 hover:text-accent transition-colors"
 >
 설정
 </Link>
 </div>
 </footer>
 </main>
 );
}
