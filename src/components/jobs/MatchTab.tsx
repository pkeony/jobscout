"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchResultView } from "@/components/match/MatchResultView";
import { ProfileForm } from "@/components/match/ProfileForm";
import { Button } from "@/components/ui/button";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { downloadMatchAsTxt } from "@/lib/text-export";
import { addHistoryEntry } from "@/lib/storage/match-history";
import {
  addProfile,
  getActiveProfile,
  loadProfiles,
  setActiveProfileId,
  updateProfile,
} from "@/lib/storage/profiles";
import { extractMatchJson } from "@/lib/prompts/match";
import { friendlyError } from "@/lib/utils";
import type { StreamEvent } from "@/lib/ai/types";
import type { MatchResult, ProfileSlot, UserProfile } from "@/types";
import type { Job } from "@/lib/storage/job-index";

interface Props {
  job: Job;
  onCompleted: () => void;
}

export function MatchTab({ job, onCompleted }: Props) {
  const [cachedResult, setCachedResult] = useState<MatchResult | null>(
    job.latestMatch?.matchResult ?? null,
  );
  const [liveResult, setLiveResult] = useState<MatchResult | null>(null);
  const [activeSlot, setActiveSlot] = useState<ProfileSlot | null>(null);
  const [allSlots, setAllSlots] = useState<ProfileSlot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const savedRef = useRef(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/match");

  const refreshSlots = useCallback(() => {
    setAllSlots(loadProfiles());
    setActiveSlot(getActiveProfile());
  }, []);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const begin = useCallback(
    (profile: UserProfile) => {
      savedRef.current = false;
      setLiveResult(null);
      reset();
      start({
        jdText: job.jdText,
        profile,
        ...(job.latestAnalyze?.analysisResult
          ? { analysisResult: job.latestAnalyze.analysisResult }
          : {}),
        ...(job.focusPosition ? { focusPosition: job.focusPosition } : {}),
      });
    },
    [job.jdText, job.focusPosition, job.latestAnalyze, start, reset],
  );

  const handleSelectSlot = useCallback(
    (id: string) => {
      setActiveProfileId(id);
      refreshSlots();
    },
    [refreshSlots],
  );

  const handleProfileSubmit = useCallback(
    (submitted: UserProfile) => {
      if (activeSlot) {
        updateProfile(activeSlot.id, { profile: submitted });
      } else {
        const created = addProfile("기본 프로필", submitted);
        setActiveProfileId(created.id);
      }
      refreshSlots();
      setShowForm(false);
      begin(submitted);
    },
    [activeSlot, refreshSlots, begin],
  );

  const handleUseActive = useCallback(() => {
    if (activeSlot) begin(activeSlot.profile);
  }, [activeSlot, begin]);

  const parsedFromStream = useMemo<MatchResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractMatchJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText]);

  useEffect(() => {
    if (status !== "done" || !parsedFromStream || savedRef.current) return;
    savedRef.current = true;
    setLiveResult(parsedFromStream);
    setCachedResult(parsedFromStream);
    addHistoryEntry({
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      jobUrl: job.jobUrl,
      focusPosition: job.focusPosition,
      profileLabel: activeSlot?.label ?? "프로필 미지정",
      jdText: job.jdText,
      matchResult: parsedFromStream,
      analysisResult: job.latestAnalyze?.analysisResult,
    });
    onCompleted();
  }, [status, parsedFromStream, job, activeSlot, onCompleted]);

  const result = liveResult ?? cachedResult;

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadMatchAsTxt(result, {
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
            onClick={() => setShowForm(true)}
            disabled={status === "streaming"}
          >
            다른 프로필로 매칭
          </Button>
        </div>
        <MatchResultView result={result} />
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {activeSlot
              ? `프로필: ${activeSlot.label}`
              : job.latestMatch?.profileLabel
                ? `프로필: ${job.latestMatch.profileLabel}`
                : ""}
          </p>
        </div>
        {showForm && activeSlot && (
          <div className="pt-4 border-t border-border">
            <div className="mb-4 flex items-center gap-3 p-3 bg-muted rounded-md">
              <span className="text-[10px] font-bold text-muted-foreground">
                프로필
              </span>
              <select
                value={activeSlot.id}
                onChange={(e) => handleSelectSlot(e.target.value)}
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
                관리 →
              </Link>
            </div>
            <ProfileForm
              key={activeSlot.id}
              initialProfile={activeSlot.profile}
              onSubmit={handleProfileSubmit}
            />
          </div>
        )}
      </div>
    );
  }

  if (status === "streaming") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 bg-accent animate-pulse rounded-full" />
          <span className="text-sm text-muted-foreground">
            프로필 매칭 분석 중...
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-l-4 border-destructive bg-card p-6 space-y-3">
        <p className="text-sm font-bold text-destructive">
          매칭 분석에 실패했습니다
        </p>
        <p className="text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button variant="outline" size="sm" onClick={() => reset()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-border rounded-lg p-8">
        <p className="text-base font-bold mb-2">프로필과 공고 적합도를 분석합니다</p>
        <p className="text-sm text-muted-foreground mb-6">
          이력서 업로드 또는 수동 입력 후 매칭을 시작하세요.
        </p>

        {allSlots.length > 0 && activeSlot && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 p-3 bg-muted rounded-md">
            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
              활성 프로필
            </span>
            <select
              value={activeSlot.id}
              onChange={(e) => handleSelectSlot(e.target.value)}
              className="flex-1 bg-card border border-input rounded-md px-3 py-1.5 text-sm"
            >
              {allSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label} · 스킬 {slot.profile.skills.length}개
                </option>
              ))}
            </select>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleUseActive}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                매칭 시작 →
              </Button>
              <Link
                href="/profiles"
                className="text-xs text-muted-foreground hover:text-foreground self-center"
              >
                관리
              </Link>
            </div>
          </div>
        )}

        <ProfileForm
          key={activeSlot?.id ?? "empty"}
          initialProfile={
            activeSlot?.profile ?? {
              skills: [],
              experience: "",
              education: undefined,
              introduction: undefined,
            }
          }
          onSubmit={handleProfileSubmit}
        />
      </div>
    </div>
  );
}
