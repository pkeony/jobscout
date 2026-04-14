"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { extractMatchJson } from "@/lib/prompts/match";
import type { MatchResult, SkillMatch, UserProfile } from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";

// ─── 프로필 입력 폼 ──────────────────────────────

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">내 프로필</CardTitle>
        <CardDescription>
          보유 스킬과 경력을 입력하세요. 프로필은 브라우저에 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            보유 스킬 <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="React, TypeScript, Node.js (쉼표로 구분)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            쉼표로 구분하여 입력하세요
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            경력 <span className="text-destructive">*</span>
          </label>
          <Textarea
            placeholder="프론트엔드 개발자 2년, React 기반 SPA 개발 경험..."
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">학력</label>
          <Input
            placeholder="컴퓨터공학 학사 (선택)"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">자기소개</label>
          <Textarea
            placeholder="간단한 자기소개 (선택)"
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
            rows={2}
          />
        </div>

        <Button onClick={handleSubmit} disabled={!isValid} className="w-full">
          매칭 분석하기
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── 스킬 매칭 뱃지 ──────────────────────────────

function SkillMatchBadge({ match }: { match: SkillMatch }) {
  const variant =
    match.status === "match"
      ? "default"
      : match.status === "partial"
        ? "secondary"
        : "destructive";

  const icon =
    match.status === "match"
      ? "✓"
      : match.status === "partial"
        ? "△"
        : "✕";

  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant={variant} className="w-6 justify-center text-xs">
        {icon}
      </Badge>
      <span className="font-medium">{match.name}</span>
      <span className="text-muted-foreground">— {match.comment}</span>
    </div>
  );
}

// ─── 매칭 결과 뷰 ────────────────────────────────

function MatchResultView({ result }: { result: MatchResult }) {
  const scoreColor =
    result.score >= 70
      ? "text-green-600 dark:text-green-400"
      : result.score >= 40
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-6">
      {/* 점수 */}
      <FadeIn>
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">매칭 점수</p>
            <p className={`text-6xl font-bold tabular-nums ${scoreColor}`}>
              {result.score}
            </p>
            <Progress value={result.score} className="h-2 max-w-xs mx-auto" />
            <p className="text-sm leading-relaxed max-w-md mx-auto">
              {result.summary}
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 스킬 매칭 상세 */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">스킬 매칭 상세</CardTitle>
          </CardHeader>
          <CardContent>
            <StaggerList className="space-y-2">
              {result.skillMatches.map((m) => (
                <StaggerItem key={m.name}>
                  <SkillMatchBadge match={m} />
                </StaggerItem>
              ))}
            </StaggerList>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 강점 */}
      {result.strengths.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">강점</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* 부족한 점 */}
      {result.gaps.length > 0 && (
        <FadeIn delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">보완 필요</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* 조언 */}
      <FadeIn delay={0.4}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">지원 전략</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{result.advice}</p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────

export default function MatchPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/match");

  // ─── sessionStorage에서 JD 복원 + localStorage 프로필 복원
  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);

    const savedProfile = localStorage.getItem("jobscout:profile");
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile) as UserProfile);
    }
  }, [router]);

  // ─── 프로필 제출 → 매칭 시작
  const handleProfileSubmit = useCallback(
    (submittedProfile: UserProfile) => {
      localStorage.setItem(
        "jobscout:profile",
        JSON.stringify(submittedProfile),
      );
      setProfile(submittedProfile);

      if (jdText) {
        start({ jdText, profile: submittedProfile });
      }
    },
    [jdText, start],
  );

  // ─── JSON 파싱
  const matchResult = useMemo<MatchResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractMatchJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText]);

  // ─── 다시 분석
  const handleRetry = () => {
    reset();
    setProfile(null);
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
          <h1 className="text-lg font-semibold">프로필 매칭</h1>
        </div>

        {/* 프로필 미입력 → 폼 */}
        {status === "idle" && (
          <FadeIn>
            <ProfileForm
              initialProfile={
                profile ?? {
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

        {/* 스트리밍 중 */}
        {status === "streaming" && (
          <FadeIn>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    프로필 매칭 분석 중...
                  </span>
                </div>
                <Progress value={null} className="h-1" />
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground rounded-md bg-muted p-3">
                  {fullText || "응답 대기 중..."}
                </pre>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* 에러 */}
        {status === "error" && (
          <FadeIn>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="text-sm text-destructive">
                  {error ?? "매칭 분석 중 오류가 발생했습니다"}
                </p>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* 결과 */}
        {status === "done" && matchResult && (
          <MatchResultView result={matchResult} />
        )}

        {/* 파싱 실패 fallback */}
        {status === "done" && !matchResult && fullText && (
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">매칭 결과 (원문)</CardTitle>
                <CardDescription>
                  구조화된 형태로 파싱하지 못했습니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm rounded-md bg-muted p-4">
                  {fullText}
                </pre>
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </main>
  );
}
