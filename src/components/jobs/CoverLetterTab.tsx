"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoverLetterView } from "@/components/cover-letter/CoverLetterView";
import { Button } from "@/components/ui/button";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { addCoverLetterHistoryEntry } from "@/lib/storage/cover-letter-history";
import {
  getActiveProfile,
  loadProfiles,
  setActiveProfileId,
} from "@/lib/storage/profiles";
import {
  downloadCoverLetterAsTxt,
  flattenCoverLetterToText,
} from "@/lib/cover-letter-export";
import { CoverLetterResultSchema, type CoverLetterResult, type ProfileSlot } from "@/types";
import { friendlyError } from "@/lib/utils";
import type { StreamEvent } from "@/lib/ai/types";
import type { Job } from "@/lib/storage/job-index";

function safeParseCoverLetter(text: string): CoverLetterResult | null {
  if (!text) return null;
  try {
    const parsed = CoverLetterResultSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

interface Props {
  job: Job;
  onCompleted: () => void;
}

export function CoverLetterTab({ job, onCompleted }: Props) {
  const [cachedResult, setCachedResult] = useState<CoverLetterResult | null>(
    job.latestCoverLetter?.coverLetterResult ?? null,
  );
  const [liveResult, setLiveResult] = useState<CoverLetterResult | null>(null);
  const [activeSlot, setActiveSlot] = useState<ProfileSlot | null>(null);
  const [allSlots, setAllSlots] = useState<ProfileSlot[]>([]);
  const [copied, setCopied] = useState(false);
  const savedRef = useRef(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/cover-letter");

  const refreshSlots = useCallback(() => {
    setAllSlots(loadProfiles());
    setActiveSlot(getActiveProfile());
  }, []);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const begin = useCallback(() => {
    const slot = getActiveProfile();
    if (!slot) return;
    savedRef.current = false;
    setLiveResult(null);
    reset();
    start({
      jdText: job.jdText,
      profile: slot.profile,
      ...(job.latestAnalyze?.analysisResult
        ? { analysisResult: job.latestAnalyze.analysisResult }
        : {}),
      ...(job.focusPosition ? { focusPosition: job.focusPosition } : {}),
    });
  }, [job.jdText, job.focusPosition, job.latestAnalyze, start, reset]);

  const parsedFromStream = useMemo<CoverLetterResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    return safeParseCoverLetter(fullText);
  }, [status, fullText]);

  useEffect(() => {
    if (status !== "done" || !parsedFromStream || savedRef.current) return;
    savedRef.current = true;
    setLiveResult(parsedFromStream);
    setCachedResult(parsedFromStream);
    sessionStorage.setItem(
      "jobscout:coverLetterResult",
      JSON.stringify(parsedFromStream),
    );
    const slot = getActiveProfile();
    addCoverLetterHistoryEntry({
      jobTitle: parsedFromStream.jobTitle || job.jobTitle,
      companyName: parsedFromStream.companyName || job.companyName,
      jobUrl: job.jobUrl,
      focusPosition: job.focusPosition,
      profileLabel: slot?.label ?? "프로필 미지정",
      jdText: job.jdText,
      coverLetterResult: parsedFromStream,
      analysisResult: job.latestAnalyze?.analysisResult,
    });
    onCompleted();
  }, [status, parsedFromStream, job, onCompleted]);

  const result = liveResult ?? cachedResult;

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(flattenCoverLetterToText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  if (result) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6 md:p-8 elevation-sm">
          <CoverLetterView result={result} />
          <div className="mt-8 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {result.sections.length}개 섹션 · 작성 완료
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? "복사됨!" : "클립보드"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCoverLetterAsTxt(result, "초안")}
              >
                .txt 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={begin}
                disabled={status === "streaming" || !activeSlot}
              >
                재생성
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "streaming") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="h-2 w-2 bg-accent animate-pulse rounded-full" />
        <span className="text-sm text-muted-foreground">
          자소서 작성 중... ({fullText.length.toLocaleString()}자)
        </span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
        <p className="text-sm font-bold text-destructive">
          자소서 생성에 실패했습니다
        </p>
        <p className="text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={begin}
          disabled={!activeSlot}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  if (!activeSlot) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
        <p className="text-base font-bold">자소서 생성에는 프로필이 필요해요</p>
        <p className="text-sm text-muted-foreground">
          먼저 프로필을 만들어 활성화하세요.
        </p>
        <div>
          <Link href="/profiles">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              프로필 만들기 →
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-8 space-y-4">
      <div>
        <p className="text-base font-bold mb-1">
          AI 가 채용공고 맞춤 자기소개서를 작성합니다
        </p>
        <p className="text-sm text-muted-foreground">
          활성 프로필 기준으로 3~6개 섹션 초안을 생성합니다.
        </p>
      </div>
      <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
        <span className="text-[10px] font-bold text-muted-foreground shrink-0">
          활성 프로필
        </span>
        <select
          value={activeSlot.id}
          onChange={(e) => {
            setActiveProfileId(e.target.value);
            refreshSlots();
          }}
          className="flex-1 bg-card border border-input rounded-md px-3 py-1.5 text-sm"
        >
          {allSlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label} · 스킬 {slot.profile.skills.length}개
            </option>
          ))}
        </select>
        <Link
          href="/profiles"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          관리
        </Link>
      </div>
      <Button
        onClick={begin}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        자소서 생성 시작 →
      </Button>
    </div>
  );
}
