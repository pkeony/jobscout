"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InterviewResultView } from "@/components/interview/InterviewResultView";
import { Button } from "@/components/ui/button";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { addInterviewHistoryEntry } from "@/lib/storage/interview-history";
import { getActiveProfile } from "@/lib/storage/profiles";
import { downloadInterviewAsTxt } from "@/lib/text-export";
import { extractInterviewJson } from "@/lib/prompts/interview";
import { friendlyError } from "@/lib/utils";
import type { StreamEvent } from "@/lib/ai/types";
import type { InterviewResult } from "@/types";
import type { Job } from "@/lib/storage/job-index";

interface Props {
  job: Job;
  onCompleted: () => void;
}

export function InterviewTab({ job, onCompleted }: Props) {
  const [cachedResult, setCachedResult] = useState<InterviewResult | null>(
    job.latestInterview?.interviewResult ?? null,
  );
  const [liveResult, setLiveResult] = useState<InterviewResult | null>(null);
  const savedRef = useRef(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/interview");

  const begin = useCallback(() => {
    savedRef.current = false;
    setLiveResult(null);
    reset();
    const slot = getActiveProfile();
    start({
      jdText: job.jdText,
      ...(slot ? { profile: slot.profile } : {}),
      ...(job.latestAnalyze?.analysisResult
        ? { analysisResult: job.latestAnalyze.analysisResult }
        : {}),
      ...(job.focusPosition ? { focusPosition: job.focusPosition } : {}),
    });
  }, [job.jdText, job.focusPosition, job.latestAnalyze, start, reset]);

  const parsedFromStream = useMemo<InterviewResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractInterviewJson(fullText);
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
      "jobscout:interviewResult",
      JSON.stringify(parsedFromStream),
    );
    addInterviewHistoryEntry({
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      jobUrl: job.jobUrl,
      focusPosition: job.focusPosition,
      jdText: job.jdText,
      interviewResult: parsedFromStream,
      analysisResult: job.latestAnalyze?.analysisResult,
    });
    onCompleted();
  }, [status, parsedFromStream, job, onCompleted]);

  const result = liveResult ?? cachedResult;

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadInterviewAsTxt(result, {
                company: job.companyName,
                jobTitle: job.jobTitle,
              })
            }
          >
            .txt 다운로드
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={begin}
            disabled={status === "streaming"}
          >
            {status === "streaming" ? "재생성 중..." : "재생성"}
          </Button>
        </div>
        <InterviewResultView result={result} />
      </div>
    );
  }

  if (status === "streaming") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="h-2 w-2 bg-accent animate-pulse rounded-full" />
        <span className="text-sm text-muted-foreground">
          면접 질문 생성 중... ({fullText.length.toLocaleString()}자)
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
        <p className="text-sm font-bold text-destructive">
          질문 생성에 실패했습니다
        </p>
        <p className="text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button variant="outline" size="sm" onClick={begin}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
      <p className="text-base font-bold mb-2">면접 예상질문을 생성합니다</p>
      <p className="text-sm text-muted-foreground mb-6">
        기술 5 · 인성 3 · 상황 2 — 총 10문항 + 면접 팁 4개
      </p>
      <Button
        onClick={begin}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        질문 생성 시작 →
      </Button>
    </div>
  );
}
