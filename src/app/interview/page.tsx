"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { extractInterviewJson } from "@/lib/prompts/interview";
import type { InterviewResult, InterviewQuestion } from "@/types";
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
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";

// ─── 질문 카드 ───────────────────────────────────

function QuestionCard({ question, index }: { question: InterviewQuestion; index: number }) {
  const [open, setOpen] = useState(false);

  const categoryLabel =
    question.category === "technical"
      ? "기술"
      : question.category === "behavioral"
        ? "인성"
        : "상황";

  const categoryVariant =
    question.category === "technical"
      ? "default"
      : question.category === "behavioral"
        ? "secondary"
        : "outline";

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-muted-foreground min-w-[1.5rem]">
            Q{index + 1}
          </span>
          <div className="flex-1 space-y-1">
            <CardTitle className="text-sm font-medium leading-relaxed">
              {question.question}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={categoryVariant} className="text-xs">
                {categoryLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {question.intent}
              </span>
            </div>
          </div>
          <span className="text-muted-foreground text-sm">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          <div className="ml-7 rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              모범 답변
            </p>
            <p className="text-sm leading-relaxed">{question.sampleAnswer}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── 결과 뷰 ─────────────────────────────────────

function InterviewResultView({ result }: { result: InterviewResult }) {
  const technical = result.questions.filter((q) => q.category === "technical");
  const behavioral = result.questions.filter((q) => q.category === "behavioral");
  const situational = result.questions.filter((q) => q.category === "situational");

  const sections = [
    { label: "기술 질문", questions: technical },
    { label: "인성 질문", questions: behavioral },
    { label: "상황 질문", questions: situational },
  ].filter((s) => s.questions.length > 0);

  let questionIndex = 0;

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <FadeIn key={section.label}>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {section.label} ({section.questions.length})
            </h2>
            <StaggerList className="space-y-3">
              {section.questions.map((q) => {
                const idx = questionIndex++;
                return (
                  <StaggerItem key={idx}>
                    <QuestionCard question={q} index={idx} />
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>
        </FadeIn>
      ))}

      {/* 면접 팁 */}
      {result.tips.length > 0 && (
        <FadeIn>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">면접 팁</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────

export default function InterviewPage() {
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const { status, fullText, error, start, reset } =
    useStreamingResponse<StreamEvent>("/api/interview");

  useEffect(() => {
    const text = sessionStorage.getItem("jobscout:jdText");
    if (!text) {
      router.replace("/");
      return;
    }
    setJdText(text);
  }, [router]);

  useEffect(() => {
    if (!jdText || started) return;
    setStarted(true);
    start({ jdText });
  }, [jdText, started, start]);

  const interviewResult = useMemo<InterviewResult | null>(() => {
    if (status !== "done" || !fullText) return null;
    try {
      return extractInterviewJson(fullText);
    } catch {
      return null;
    }
  }, [status, fullText]);

  const handleRetry = () => {
    reset();
    setStarted(false);
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
          <h1 className="text-lg font-semibold">면접 예상질문</h1>
        </div>

        {/* 스트리밍 중 */}
        {status === "streaming" && (
          <FadeIn>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    면접 질문을 생성하고 있습니다...
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
                  {error ?? "질문 생성 중 오류가 발생했습니다"}
                </p>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* 결과 */}
        {status === "done" && interviewResult && (
          <InterviewResultView result={interviewResult} />
        )}

        {/* 파싱 실패 */}
        {status === "done" && !interviewResult && fullText && (
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">면접 질문 (원문)</CardTitle>
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
