"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { extractJson } from "@/lib/prompts/analyze";
import type { AnalysisResult, Skill } from "@/types";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";

interface CrawlMeta {
  title: string;
  company: string;
  url: string;
}

function SkillBadge({ skill }: { skill: Skill }) {
  const variant =
    skill.category === "required"
      ? "default"
      : skill.category === "preferred"
        ? "secondary"
        : "outline";

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={variant} className="cursor-default">
          {skill.name}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{skill.context}</p>
        {skill.level !== "unspecified" && (
          <p className="text-xs text-muted-foreground mt-1">
            요구 수준: {skill.level}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function SkillsSection({ skills }: { skills: Skill[] }) {
  const required = skills.filter((s) => s.category === "required");
  const preferred = skills.filter((s) => s.category === "preferred");
  const etc = skills.filter((s) => s.category === "etc");

  return (
    <div className="space-y-4">
      {required.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">필수 스킬</h3>
          <StaggerList className="flex flex-wrap gap-2">
            {required.map((s) => (
              <StaggerItem key={s.name}>
                <SkillBadge skill={s} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}
      {preferred.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">우대 스킬</h3>
          <StaggerList className="flex flex-wrap gap-2">
            {preferred.map((s) => (
              <StaggerItem key={s.name}>
                <SkillBadge skill={s} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}
      {etc.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">기타</h3>
          <StaggerList className="flex flex-wrap gap-2">
            {etc.map((s) => (
              <StaggerItem key={s.name}>
                <SkillBadge skill={s} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}
    </div>
  );
}

function AnalysisResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-6">
      {/* 직무 요약 */}
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle>{result.roleTitle}</CardTitle>
            <CardDescription>
              {result.companyInfo.name}
              {result.experienceLevel && ` · ${result.experienceLevel}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 스킬 */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기술 스택</CardTitle>
          </CardHeader>
          <CardContent>
            <SkillsSection skills={result.skills} />
          </CardContent>
        </Card>
      </FadeIn>

      {/* 주요 업무 */}
      {result.keyResponsibilities.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">주요 업무</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.keyResponsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* 회사 정보 */}
      <FadeIn delay={0.3}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">회사 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.companyInfo.industry && (
              <p>
                <span className="text-muted-foreground">업종:</span>{" "}
                {result.companyInfo.industry}
              </p>
            )}
            {result.companyInfo.size && (
              <p>
                <span className="text-muted-foreground">규모:</span>{" "}
                {result.companyInfo.size}
              </p>
            )}
            {result.companyInfo.culture.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.companyInfo.culture.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* 복리후생 */}
      {result.benefits.length > 0 && (
        <FadeIn delay={0.4}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">복리후생</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  const router = useRouter();
  const [crawlMeta, setCrawlMeta] = useState<CrawlMeta | null>(null);
  const [jdText, setJdText] = useState<string | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/analyze");

  // ─── sessionStorage에서 데이터 복원 ──────────────
  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);

    const metaStr = sessionStorage.getItem("jobscout:crawlMeta");
    if (metaStr) {
      setCrawlMeta(JSON.parse(metaStr) as CrawlMeta);
    }
  }, [router]);

  // ─── 분석 시작 ─────────────────────────────────
  useEffect(() => {
    if (!jdText || analysisStarted) return;

    const apiKey = localStorage.getItem("jobscout:apiKey");
    if (!apiKey) {
      router.replace("/");
      return;
    }

    setAnalysisStarted(true);
    start({ text: jdText, apiKey });
  }, [jdText, analysisStarted, start, router]);

  // ─── JSON 파싱 ─────────────────────────────────
  const analysisResult = useMemo<AnalysisResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText]);

  // ─── 재시도 ────────────────────────────────────
  const handleRetry = () => {
    reset();
    setAnalysisStarted(false);
  };

  // ─── 로딩 중 (데이터 없음) ────────────────────
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
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            ← 뒤로
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">
              {crawlMeta?.title ?? "JD 분석"}
            </h1>
            {crawlMeta?.company && (
              <p className="text-sm text-muted-foreground truncate">
                {crawlMeta.company}
              </p>
            )}
          </div>
        </div>

        {/* 스트리밍 중 */}
        {status === "streaming" && (
          <FadeIn>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    AI가 채용공고를 분석하고 있습니다...
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
                  {error ?? "분석 중 오류가 발생했습니다"}
                </p>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* 분석 완료 — 구조화 결과 */}
        {status === "done" && analysisResult && (
          <AnalysisResultView result={analysisResult} />
        )}

        {/* 분석 완료 — JSON 파싱 실패 fallback */}
        {status === "done" && !analysisResult && fullText && (
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">분석 결과 (원문)</CardTitle>
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
