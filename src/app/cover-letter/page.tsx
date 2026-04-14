"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import type { UserProfile } from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FadeIn } from "@/components/motion";

export default function CoverLetterPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const startedRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/cover-letter");

  // ─── 데이터 복원 + 자동 시작
  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);

    const savedProfile = localStorage.getItem("jobscout:profile");
    if (!savedProfile) {
      router.replace("/match");
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      const profile = JSON.parse(savedProfile) as UserProfile;
      start({ jdText: text, profile });
    }
  }, [router, start]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fullText]);

  const handleRetry = () => {
    reset();
    startedRef.current = false;
    const text = sessionStorage.getItem("jobscout:jdText");
    const savedProfile = localStorage.getItem("jobscout:profile");
    if (text && savedProfile) {
      startedRef.current = true;
      const profile = JSON.parse(savedProfile) as UserProfile;
      start({ jdText: text, profile });
    }
  };

  if (!jdText) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/analyze")}
          >
            ← 분석 결과
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">자기소개서 초안</h1>
        </div>

        {/* 스트리밍 중 */}
        {(status === "streaming" || status === "done") && fullText && (
          <FadeIn>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {status === "streaming" ? "작성 중..." : "자기소개서"}
                </CardTitle>
                {status === "done" && (
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? "복사됨!" : "복사"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{fullText}</ReactMarkdown>
                </div>
                {status === "streaming" && (
                  <Progress value={null} className="h-1 mt-4" />
                )}
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* 대기 중 */}
        {status === "idle" && (
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        )}

        {/* 에러 */}
        {status === "error" && (
          <FadeIn>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm text-destructive">
                  {error ?? "자소서 생성 중 오류가 발생했습니다"}
                </p>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </main>
  );
}
