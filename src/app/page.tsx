"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/motion";

export default function HomePage() {
  const router = useRouter();

  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [jdText, setJdText] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const goToAnalyze = useCallback(
    (text: string, meta?: { title: string; company: string; url: string }) => {
      sessionStorage.setItem("jobscout:jdText", text);
      if (meta) {
        sessionStorage.setItem("jobscout:crawlMeta", JSON.stringify(meta));
      }
      router.push("/analyze");
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
      };
      goToAnalyze(data.text, {
        title: data.title,
        company: data.company,
        url: data.url,
      });
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

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12 sm:py-20">
      <FadeIn className="w-full max-w-2xl space-y-8">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">JobScout</h1>
          <p className="text-muted-foreground text-lg">
            AI 채용공고 분석기 — JD를 넣으면 스킬, 매칭, 자소서까지
          </p>
        </div>

        {/* JD 입력 */}
        <Card>
          <CardContent className="pt-6">
            <Tabs
              value={inputMode}
              onValueChange={(v) => setInputMode(v as "url" | "text")}
            >
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="url" className="flex-1">
                  URL 입력
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1">
                  텍스트 직접 입력
                </TabsTrigger>
              </TabsList>

              {/* URL 탭 */}
              <TabsContent value="url" className="space-y-4">
                <Input
                  placeholder="https://www.wanted.co.kr/wd/123456"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                  disabled={crawlStatus === "loading"}
                />

                {crawlStatus === "loading" && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <p className="text-sm text-muted-foreground">
                      채용공고를 가져오는 중...
                    </p>
                  </div>
                )}

                {crawlStatus === "error" && crawlError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <p>{crawlError}</p>
                    <button
                      className="mt-1 underline text-xs"
                      onClick={() => setInputMode("text")}
                    >
                      텍스트로 직접 입력하기
                    </button>
                  </div>
                )}

                <Button
                  onClick={handleUrlSubmit}
                  disabled={!url.trim() || crawlStatus === "loading"}
                  className="w-full"
                >
                  {crawlStatus === "loading" ? "가져오는 중..." : "분석하기"}
                </Button>
              </TabsContent>

              {/* 텍스트 탭 */}
              <TabsContent value="text" className="space-y-4">
                <Textarea
                  placeholder="채용공고 텍스트를 붙여넣으세요 (최소 50자)"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={10}
                  className="resize-y"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {jdText.length}자
                  </span>
                  <Button
                    onClick={handleTextSubmit}
                    disabled={!jdText.trim() || jdText.trim().length < 50}
                  >
                    분석하기
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 기능 소개 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: "🔍", label: "스킬 분석" },
            { icon: "🎯", label: "프로필 매칭" },
            { icon: "📝", label: "자소서 초안" },
            { icon: "💬", label: "면접 예상질문" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </FadeIn>
    </main>
  );
}
