"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AnalysisProgress } from "@/components/analyze/AnalysisProgress";
import { PositionPicker } from "@/components/analyze/PositionPicker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FadeIn } from "@/components/motion";
import { getJobKey } from "@/lib/storage/job-index";

interface CrawlMeta {
  title: string;
  company: string;
  url: string;
}

export default function NewJobPage() {
  const router = useRouter();

  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [pendingCrawl, setPendingCrawl] = useState<{
    text: string;
    positions: string[];
    meta: CrawlMeta;
  } | null>(null);

  const goToAnalyze = useCallback(
    (text: string, meta?: CrawlMeta, focusPosition?: string) => {
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const meta: CrawlMeta = {
        title: data.title,
        company: data.company,
        url: data.url,
      };
      const positions = data.positions ?? [];
      if (positions.length === 1) {
        goToAnalyze(data.text, meta);
      } else {
        setPendingCrawl({ text: data.text, positions, meta });
      }
    } catch (err) {
      setCrawlStatus("error");
      setCrawlError(
        err instanceof Error
          ? err.message
          : "크롤링 중 오류가 발생했습니다",
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

  // 크롤링 중
  if (crawlStatus === "loading" && !pendingCrawl) {
    return (
      <AppShell
        ribbonLeft={<>새 공고 · 수집 중</>}
        ribbonRight={<>STATUS: CRAWLING</>}
      >
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <AnalysisProgress inputMode="url" deltaChars={0} phase="crawling" />
          </FadeIn>
        </div>
      </AppShell>
    );
  }

  // 다중 포지션 피커
  if (pendingCrawl) {
    return (
      <AppShell
        ribbonLeft={<>새 공고 · 포지션 선택</>}
        ribbonRight={
          pendingCrawl.positions.length > 0 ? (
            <>{pendingCrawl.positions.length}개 포지션 감지</>
          ) : (
            <>포지션 자동 감지 실패</>
          )
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
    <AppShell ribbonLeft={<>새 공고</>} ribbonRight={<>대기 중</>}>
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <Link
            href="/jobs"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
          >
            ← 공고 목록
          </Link>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
            새 공고 추가
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            채용공고 URL 을 붙여넣거나 텍스트를 직접 입력하면 워크스페이스가 생성돼요.
          </p>
        </FadeIn>

        <FadeIn delay={0.04}>
          <Tabs
            value={inputMode}
            onValueChange={(v) => setInputMode(v as "url" | "text")}
          >
            <TabsList variant="line" className="mb-6 w-full">
              <TabsTrigger value="url" className="flex-1">
                URL
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                텍스트
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <input
                className="w-full bg-transparent border-b-2 border-input focus:border-accent outline-none py-4 text-lg placeholder:text-muted-foreground transition-colors"
                placeholder="https://www.wanted.co.kr/wd/123456"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />

              {crawlStatus === "error" && crawlError && (
                <div className="border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
                  <p className="text-destructive font-medium">{crawlError}</p>
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
                disabled={!url.trim()}
                className="w-full bg-accent text-accent-foreground py-5 text-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
              >
                분석 시작
                <span>→</span>
              </button>
              <p className="text-xs text-muted-foreground">
                포지션이 2개 이상 감지되면 선택 화면이 먼저 나타납니다.
              </p>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <Textarea
                placeholder="채용공고 텍스트를 붙여넣으세요 (최소 50자)"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={14}
                className="resize-y min-h-[320px]"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {jdText.length}자
                  {jdText.length > 0 && jdText.length < 50 && (
                    <span className="text-destructive ml-1">(최소 50자)</span>
                  )}
                </span>
                <button
                  onClick={handleTextSubmit}
                  disabled={!jdText.trim() || jdText.trim().length < 50}
                  className="bg-accent text-accent-foreground px-8 py-3 text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
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
