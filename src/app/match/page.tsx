"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { extractMatchJson } from "@/lib/prompts/match";
import { AnalysisResultSchema, type MatchResult, type ProfileSlot, type SkillMatch, type UserProfile } from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import {
  addProfile,
  getActiveProfile,
  loadProfiles,
  setActiveProfileId,
  updateProfile,
} from "@/lib/storage/profiles";

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
import { cn, friendlyError } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";
import { FileDropZone } from "@/components/file-drop-zone";
import { AppShell } from "@/components/app-shell";
import { PixelProgressRing } from "@/components/pixel-progress-ring";
import { ScoreBreakdownBar } from "@/components/score-breakdown-bar";

// ─── 프로필 입력 폼 ──────────────────────────────────

function ProfileForm({
  initialProfile,
  onSubmit,
}: {
  initialProfile: UserProfile;
  onSubmit: (profile: UserProfile) => void;
}) {
  const [skills, setSkills] = useState(initialProfile.skills.join(", "));
  const [experience, setExperience] = useState(initialProfile.experience);
  const [education, setEducation] = useState(initialProfile.education ?? "");
  const [introduction, setIntroduction] = useState(
    initialProfile.introduction ?? "",
  );
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeAutoFilled, setResumeAutoFilled] = useState(false);

  const handleResumeFile = useCallback(async (file: File) => {
    setResumeLoading(true);
    setResumeError(null);
    setResumeAutoFilled(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        setResumeError(body.error ?? "이력서 파싱에 실패했습니다");
        return;
      }

      const { profile } = (await res.json()) as { profile: UserProfile };
      setSkills(profile.skills.join(", "));
      setExperience(profile.experience);
      setEducation(profile.education ?? "");
      setIntroduction(profile.introduction ?? "");
      setResumeAutoFilled(true);
    } catch {
      setResumeError("이력서 파싱 중 오류가 발생했습니다");
    } finally {
      setResumeLoading(false);
    }
  }, []);

  const handleSubmit = () => {
    const profile: UserProfile = {
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      experience,
      education: education || undefined,
      introduction: introduction || undefined,
    };
    onSubmit(profile);
  };

  const isValid = skills.trim().length > 0 && experience.trim().length > 0;

  return (
    <>
      {resumeAutoFilled && !resumeError && (
        <div className="border-l-4 border-accent bg-accent/10 px-4 py-3 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-accent font-mono text-xs font-bold shrink-0">✓</span>
            <span className="text-sm leading-snug">
              이력서에서 프로필 추출 완료 — <strong>아래 항목을 검토</strong>한 뒤 매칭을 시작하세요.
            </span>
          </div>
          <button
            onClick={() => setResumeAutoFilled(false)}
            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 shrink-0"
          >
            다시 업로드
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-foreground">
      {/* 좌측: 파일 업로드 */}
      <div className="p-8 bg-muted/30 border-r-0 md:border-r-2 border-border">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold italic">
              이력서 업로드
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              자동 프로필 추출
            </span>
          </div>
        </div>
        <FileDropZone
          accept=".pdf,.docx,.txt"
          label={resumeLoading ? "이력서 분석 중..." : "이력서를 드래그하세요"}
          description="PDF, DOCX, TXT (5MB 이하) — 자동으로 프로필을 채워드립니다"
          onFile={handleResumeFile}
          isLoading={resumeLoading}
        />
        {resumeError && (
          <p className="text-sm text-destructive mt-3">{resumeError}</p>
        )}
      </div>

      {/* 우측: 수동 입력 */}
      <div className="p-8 bg-muted relative">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold italic">
              직접 입력
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              프로필 정보 기입
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              보유 스킬 <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="React, TypeScript, Node.js"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">쉼표로 구분</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              경력 <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="프론트엔드 개발자 2년..."
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              학력
            </label>
            <Input
              placeholder="컴퓨터공학 학사 (선택)"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              자기소개
            </label>
            <Textarea
              placeholder="간단한 자기소개 (선택)"
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full bg-secondary text-secondary-foreground px-8 py-5 text-sm uppercase tracking-[0.2em] font-bold hover:bg-foreground hover:text-background transition-colors duration-75 h-auto"
          >
            매칭 분석 시작
            <span className="ml-2">→</span>
          </Button>
        </div>
        {/* 워터마크 */}
        <div className="absolute bottom-6 right-6 opacity-[0.03] select-none pointer-events-none">
          <span className="font-heading italic font-black text-7xl">MATCH</span>
        </div>
      </div>
      </div>
    </>
  );
}

// ─── 스킬 매칭 아이템 ───────────────────────────────

function SkillMatchItem({ match }: { match: SkillMatch }) {
  const icon =
    match.status === "match" ? "✓" : match.status === "partial" ? "△" : "✕";

  return (
    <div
      className={cn(
        "border-l-4 p-4 bg-card text-sm",
        match.status === "match" && "border-accent",
        match.status === "partial" && "border-secondary",
        match.status === "gap" && "border-destructive",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "font-mono text-xs font-bold",
            match.status === "match" && "text-accent",
            match.status === "partial" && "text-secondary",
            match.status === "gap" && "text-destructive",
          )}
        >
          {icon}
        </span>
        <span className="font-bold">{match.name}</span>
      </div>
      <p className="text-muted-foreground text-xs ml-5">{match.comment}</p>
    </div>
  );
}

// ─── 스트리밍 스켈레톤 ──────────────────────────────

function MatchSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col md:flex-row justify-between items-end gap-8">
        <div className="w-full md:w-2/3">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-12 w-[60%] mb-3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4 mt-2" />
        </div>
        <div className="w-48 h-48 bg-muted border-4 border-foreground/20" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-foreground/20">
        <div className="p-8 bg-muted/30 space-y-4">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 bg-card border-l-4 border-border space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
        <div className="p-8 bg-muted space-y-4">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 bg-card/60 border-l-4 border-foreground/20 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-foreground p-1">
        <div className="px-4 py-2"><Skeleton className="h-3 w-28" /></div>
        <div className="bg-card p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-l-4 border-border p-4 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────

export default function MatchPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<ProfileSlot | null>(null);
  const [allSlots, setAllSlots] = useState<ProfileSlot[]>([]);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/match");

  const refreshSlots = useCallback(() => {
    setAllSlots(loadProfiles());
    setActiveSlot(getActiveProfile());
  }, []);

  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);
    refreshSlots();
  }, [router, refreshSlots]);

  const handleSelectSlot = useCallback(
    (id: string) => {
      setActiveProfileId(id);
      refreshSlots();
    },
    [refreshSlots],
  );

  const handleProfileSubmit = useCallback(
    (submittedProfile: UserProfile) => {
      // 활성 슬롯이 있으면 그 슬롯의 profile만 업데이트, 없으면 새 슬롯 생성
      if (activeSlot) {
        updateProfile(activeSlot.id, { profile: submittedProfile });
      } else {
        const created = addProfile("기본 프로필", submittedProfile);
        setActiveProfileId(created.id);
      }
      refreshSlots();

      if (jdText) {
        start({ jdText, profile: submittedProfile, ...readAnalysisExtras() });
      }
    },
    [activeSlot, jdText, start, refreshSlots],
  );

  const matchResult = useMemo<MatchResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractMatchJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText]);

  const sortedSkillMatches = useMemo(() => {
    if (!matchResult) return [];
    const order: Record<SkillMatch["status"], number> = { gap: 0, partial: 1, match: 2 };
    return [...matchResult.skillMatches].sort(
      (a, b) => order[a.status] - order[b.status],
    );
  }, [matchResult]);

  useEffect(() => {
    const sb = matchResult?.scoreBreakdown;
    if (!sb) return;
    const sum = sb.requiredSkills.earned + sb.preferredSkills.earned + sb.experience.earned + sb.base;
    if (Math.abs(sum - matchResult.score) > 1 && matchResult.score !== 100) {
      console.warn("[match] scoreBreakdown sum mismatch", { sum, score: matchResult.score, sb });
    }
  }, [matchResult]);

  const handleRetry = () => {
    reset();
  };

  if (!jdText) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  return (
    <AppShell
      ribbonLeft={<>프로필 매칭</>}
      ribbonRight={<>STATUS: {status.toUpperCase()}</>}
    >
      <div className="max-w-6xl mx-auto space-y-0">
        {/* ───────── 프로필 입력 (idle) ───────── */}
        {status === "idle" && (
          <FadeIn>
            <div className="mb-12">
              <span className="inline-block bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-bold mb-4">
                적합도 분석
              </span>
              <h1 className="font-heading text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
                프로필 매칭
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                이력서 또는 프로필 정보를 입력하면 채용공고와의 적합도를 분석합니다.
              </p>
            </div>
            {allSlots.length > 0 && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-2 border-foreground/10 bg-muted/30">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                    프로필
                  </span>
                  <select
                    value={activeSlot?.id ?? ""}
                    onChange={(e) => handleSelectSlot(e.target.value)}
                    className="flex-1 min-w-0 bg-card border-2 border-foreground/20 px-3 py-2 text-sm font-medium focus:border-secondary focus:outline-none"
                  >
                    {allSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.label} · 스킬 {slot.profile.skills.length}개
                      </option>
                    ))}
                  </select>
                </div>
                <Link
                  href="/profiles"
                  className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 shrink-0"
                >
                  프로필 관리 →
                </Link>
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
          </FadeIn>
        )}

        {/* ───────── 스트리밍 중 ───────── */}
        {status === "streaming" && (
          <FadeIn>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
                프로필 매칭 분석 중...
              </span>
            </div>
            <MatchSkeleton />
          </FadeIn>
        )}

        {/* ───────── 에러 ───────── */}
        {status === "error" && (
          <FadeIn>
            <div className="border-l-4 border-destructive bg-card p-8 space-y-4">
              <h3 className="font-heading text-xl font-bold text-destructive">
                매칭 분석에 실패했습니다
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

        {/* ───────── 매칭 결과 ───────── */}
        {status === "done" && matchResult && (
          <>
            {/* 히어로 헤더 */}
            <FadeIn>
              <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12">
                <div className="w-full md:w-2/3">
                  <span className="inline-block bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-bold mb-4">
                    매칭 결과
                  </span>
                  <h1 className="font-heading text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
                    적합도 분석
                  </h1>
                  <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                    {matchResult.summary}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <PixelProgressRing score={matchResult.score} className="w-48 h-48" />
                  {matchResult.scoreBreakdown && (
                    <ScoreBreakdownBar breakdown={matchResult.scoreBreakdown} />
                  )}
                </div>
              </div>
            </FadeIn>

            {/* 좌우 대비: 강점 vs 보완 */}
            <FadeIn delay={0.03}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-12 border-t-4 border-foreground">
                {/* 강점 */}
                <div className="p-8 border-r-0 md:border-r-2 border-border bg-muted/30">
                  <div className="mb-8">
                    <h2 className="font-heading text-2xl font-bold italic">강점</h2>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      보유 역량 매칭
                    </span>
                  </div>
                  <div className="space-y-4">
                    {matchResult.strengths.map((s, i) => (
                      <div key={i} className="p-4 bg-card border-l-4 border-accent">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase text-accent">
                            강점 {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 보완 필요 */}
                <div className="p-8 bg-muted relative">
                  <div className="mb-8">
                    <h2 className="font-heading text-2xl font-bold italic">보완 필요</h2>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      갭 분석
                    </span>
                  </div>
                  <div className="space-y-4">
                    {matchResult.gaps.map((g, i) => (
                      <div key={i} className="p-4 bg-card/60 border-l-4 border-destructive">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase text-destructive">
                            갭 {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{g}</p>
                      </div>
                    ))}
                  </div>
                  <div className="absolute bottom-8 right-8 opacity-[0.03] select-none pointer-events-none">
                    <span className="font-heading italic font-black text-8xl">GAP</span>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* 스킬별 상세 — 다크 프레임 */}
            <FadeIn delay={0.06}>
              <div className="bg-foreground p-1 mb-12">
                <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest flex items-center gap-2 text-background/80">
                    <span className="w-2 h-2 bg-secondary" />
                    스킬별 상세 분석
                  </span>
                  <div className="flex gap-2">
                    <span className="w-3 h-3 bg-background/20" />
                    <span className="w-3 h-3 bg-background/20" />
                    <span className="w-3 h-3 bg-background/20" />
                  </div>
                </div>
                <div className="bg-card p-8 dot-matrix-texture">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StaggerList className="contents">
                      {sortedSkillMatches.map((m) => (
                        <StaggerItem key={m.name}>
                          <SkillMatchItem match={m} />
                        </StaggerItem>
                      ))}
                    </StaggerList>
                  </div>

                  {/* 지원 전략 */}
                  <div className="mt-8 pt-8 border-t border-border/30">
                    <h4 className="font-heading font-bold text-lg border-b-2 border-secondary pb-1 inline-block mb-4">
                      지원 전략
                    </h4>
                    <p className="text-sm leading-relaxed max-w-3xl">
                      {matchResult.advice}
                    </p>
                  </div>

                  <div className="mt-12 flex justify-center">
                    <Button
                      onClick={() => router.push("/cover-letter")}
                      className="bg-secondary text-secondary-foreground px-10 py-6 text-sm uppercase tracking-[0.3em] font-bold hover:bg-foreground hover:text-background transition-colors duration-75 h-auto"
                    >
                      자소서 생성하기
                      <span className="ml-3">→</span>
                    </Button>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* 하단 액션 카드 */}
            <FadeIn delay={0.09}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push("/cover-letter")}
                  className="p-6 bg-muted border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">01</span>
                  <h4 className="font-heading text-lg font-bold mt-2 mb-1">자소서 생성</h4>
                  <p className="text-xs text-muted-foreground">채용공고 + 프로필 기반 맞춤형 자기소개서를 작성합니다.</p>
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
          </>
        )}

        {/* 파싱 실패 fallback */}
        {status === "done" && !matchResult && fullText && (
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
      </div>
    </AppShell>
  );
}
