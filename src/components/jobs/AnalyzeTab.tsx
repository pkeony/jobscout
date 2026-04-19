"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyzeResultView } from "@/components/analyze/AnalyzeResultView";
import { Button } from "@/components/ui/button";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { addAnalyzeHistoryEntry } from "@/lib/storage/analyze-history";
import { extractJson } from "@/lib/prompts/analyze";
import { friendlyError } from "@/lib/utils";
import type { StreamEvent } from "@/lib/ai/types";
import type { AnalysisResult } from "@/types";
import type { Job } from "@/lib/storage/job-index";

interface Props {
  job: Job;
  autoStart?: boolean;
  onCompleted: () => void;
}

export function AnalyzeTab({ job, autoStart, onCompleted }: Props) {
  const [cachedResult, setCachedResult] = useState<AnalysisResult | null>(
    job.latestAnalyze?.analysisResult ?? null,
  );
  const [liveResult, setLiveResult] = useState<AnalysisResult | null>(null);
  const savedRef = useRef(false);
  const startedOnceRef = useRef(false);
  const autoRetriedRef = useRef(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/analyze");

  const begin = useCallback(() => {
    savedRef.current = false;
    autoRetriedRef.current = false;
    setLiveResult(null);
    reset();
    start(
      job.focusPosition
        ? { text: job.jdText, focusPosition: job.focusPosition }
        : { text: job.jdText },
    );
  }, [job.jdText, job.focusPosition, start, reset]);

  const retryOnce = useCallback(() => {
    savedRef.current = false;
    setLiveResult(null);
    reset();
    start(
      job.focusPosition
        ? { text: job.jdText, focusPosition: job.focusPosition }
        : { text: job.jdText },
    );
  }, [job.jdText, job.focusPosition, start, reset]);

  useEffect(() => {
    if (!autoStart) return;
    if (cachedResult) return;
    if (startedOnceRef.current) return;
    startedOnceRef.current = true;
    begin();
  }, [autoStart, cachedResult, begin]);

  const parsedFromStream = useMemo<AnalysisResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText]);

  useEffect(() => {
    if (status !== "done" || !parsedFromStream || savedRef.current) return;
    savedRef.current = true;
    setLiveResult(parsedFromStream);
    setCachedResult(parsedFromStream);
    sessionStorage.setItem(
      "jobscout:analyzeResult",
      JSON.stringify(parsedFromStream),
    );
    addAnalyzeHistoryEntry({
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      jobUrl: job.jobUrl,
      focusPosition: job.focusPosition,
      jdText: job.jdText,
      analysisResult: parsedFromStream,
    });
    onCompleted();
  }, [status, parsedFromStream, job, onCompleted]);

  // Gemini mid-stream 끊김 대응: 파싱 실패 시 1회 자동 재시도
  useEffect(() => {
    if (
      status !== "done" ||
      parsedFromStream ||
      !fullText ||
      autoRetriedRef.current
    )
      return;
    autoRetriedRef.current = true;
    retryOnce();
  }, [status, parsedFromStream, fullText, retryOnce]);

  const result = liveResult ?? cachedResult;

  if (result) {
    return (
      <div className="space-y-6">
        <AnalyzeResultView result={result} />
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={begin}
            disabled={status === "streaming"}
          >
            {status === "streaming" ? "재분석 중..." : "재분석"}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "streaming") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 bg-accent animate-pulse rounded-full" />
          <span className="text-sm text-muted-foreground">
            AI 가 채용공고를 분석 중입니다... ({fullText.length.toLocaleString()}자
            수신)
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
        <p className="text-sm font-bold text-destructive">
          분석에 실패했습니다
        </p>
        <p className="text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button variant="outline" size="sm" onClick={begin}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (status === "done" && !parsedFromStream && fullText && autoRetriedRef.current) {
    return (
      <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
        <p className="text-sm font-medium text-destructive">
          AI 응답이 두 번 연속 중간에 끊겼습니다.
        </p>
        <p className="text-xs text-muted-foreground">
          Gemini 서버가 혼잡한 상태일 수 있습니다. 잠시 후 다시 시도해주세요.
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">원문 보기</summary>
          <pre className="mt-2 whitespace-pre-wrap bg-muted p-3 max-h-80 overflow-auto">
            {fullText}
          </pre>
        </details>
        <Button variant="outline" size="sm" onClick={begin}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (status === "done" && !parsedFromStream && !fullText) {
    return (
      <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
        <p className="text-sm font-medium text-destructive">
          AI 서버가 응답하지 않았습니다.
        </p>
        <Button variant="outline" size="sm" onClick={begin}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
      <p className="text-base font-bold mb-2">이 공고는 아직 분석되지 않았어요</p>
      <p className="text-sm text-muted-foreground mb-6">
        AI 가 스킬 · 자격요건 · 회사정보를 추출합니다.
      </p>
      <Button
        onClick={begin}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        분석 시작 →
      </Button>
    </div>
  );
}
