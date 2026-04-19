"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import {
  AnalysisResultSchema,
  CoverLetterResultSchema,
  CoverLetterRefineResultSchema,
  CoverLetterTraceResultSchema,
  InterviewResultSchema,
  type AnalysisResult,
  type CoverLetterRefineResult,
  type CoverLetterResult,
  type CoverLetterTraceResult,
  type InterviewResult,
} from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { friendlyError } from "@/lib/utils";
import { CoverLetterDiffView } from "./CoverLetterDiffView";

function readAnalysisExtras(): {
  analysisResult?: AnalysisResult;
  focusPosition?: string;
} {
  const extras: { analysisResult?: AnalysisResult; focusPosition?: string } = {};
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

function safeParseSession<T>(
  key: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
): T | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data ? parsed.data : null;
  } catch {
    return null;
  }
}

export function RefineFromInterviewSection({ jdText }: { jdText: string }) {
  const [v0, setV0] = useState<CoverLetterResult | null>(null);
  const [interview, setInterview] = useState<InterviewResult | null>(null);
  const [traceResult, setTraceResult] = useState<CoverLetterTraceResult | null>(null);
  const [refineResult, setRefineResult] = useState<CoverLetterRefineResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const trace = useStreamingResponse<StreamEvent>("/api/cover-letter-trace");
  const refine = useStreamingResponse<StreamEvent>("/api/cover-letter-refine");

  // sessionStorage 동기화 — page mount + 같은 페이지 내 자소서 생성/면접 다녀온 직후 모두 커버
  useEffect(() => {
    const sync = () => {
      setV0(safeParseSession("jobscout:coverLetterResult", CoverLetterResultSchema));
      setInterview(safeParseSession("jobscout:interviewResult", InterviewResultSchema));
    };
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  // trace 결과 파싱 — done 시점에 fullText 가 완전한 JSON
  useEffect(() => {
    if (trace.status !== "done" || !trace.fullText) return;
    try {
      const parsed = CoverLetterTraceResultSchema.parse(JSON.parse(trace.fullText));
      setTraceResult(parsed);
      setSelectedIds(new Set(parsed.weaknesses.map((w) => w.id)));
    } catch {
      // 파싱 실패는 trace.status 가 done 인데 traceResult null → 별도 안내
    }
  }, [trace.status, trace.fullText]);

  useEffect(() => {
    if (refine.status !== "done" || !refine.fullText) return;
    try {
      const parsed = CoverLetterRefineResultSchema.parse(JSON.parse(refine.fullText));
      setRefineResult(parsed);
    } catch {
      // 파싱 실패
    }
  }, [refine.status, refine.fullText]);

  const handleStartTrace = useCallback(() => {
    if (!v0 || !interview) return;
    setTraceResult(null);
    setRefineResult(null);
    setSelectedIds(new Set());
    const extras = readAnalysisExtras();
    trace.start({
      coverLetter: v0,
      interviewResult: interview,
      jdText,
      ...extras,
    });
  }, [v0, interview, jdText, trace]);

  const handleStartRefine = useCallback(() => {
    if (!v0 || !interview || !traceResult) return;
    const selected = traceResult.weaknesses.filter((w) => selectedIds.has(w.id));
    if (selected.length === 0) return;
    setRefineResult(null);
    const extras = readAnalysisExtras();
    refine.start({
      coverLetter: v0,
      interviewResult: interview,
      weaknesses: selected,
      jdText,
      ...extras,
    });
  }, [v0, interview, traceResult, selectedIds, jdText, refine]);

  const toggleWeakness = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const traceParseFailed = useMemo(
    () =>
      trace.status === "done" && !traceResult && trace.fullText.length > 0,
    [trace.status, traceResult, trace.fullText],
  );

  const refineParseFailed = useMemo(
    () =>
      refine.status === "done" && !refineResult && refine.fullText.length > 0,
    [refine.status, refineResult, refine.fullText],
  );

  // 자소서 v0 또는 면접 결과 누락 — disabled + CTA
  if (!v0 || !interview) {
    return (
      <div className="border-t-4 border-foreground p-8 bg-muted/30">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-1">
              피처 D · 면접 역추적
            </p>
            <h2 className="font-heading text-2xl font-bold italic mb-2">
              면접 질문으로 자소서 보강
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              자소서와 예상 면접 질문이 모두 있어야 약점을 추출할 수 있습니다.
              {!v0 && " 위 단계에서 자소서를 먼저 생성하세요."}
              {v0 && !interview && " 아래 링크로 면접 질문을 먼저 생성한 뒤 돌아오세요."}
            </p>
          </div>
          {v0 && !interview && (
            <Link
              href="/interview"
              className="inline-block bg-secondary text-secondary-foreground px-4 py-2 text-xs uppercase tracking-widest font-bold hover:opacity-90"
            >
              면접 질문 생성하러 가기 →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t-4 border-foreground p-8 bg-muted/30 space-y-8 relative">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-1">
          피처 D · 면접 역추적
        </p>
        <h2 className="font-heading text-2xl font-bold italic mb-2">
          면접 질문으로 자소서 보강
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          예상 면접 질문 {interview.questions.length}개의 의도를 거꾸로 추적해 자소서의 약점을
          찾고, 약점만 보강한 v1 을 생성합니다. 자소서에 없는 사실을 만들지 않습니다.
        </p>
      </div>

      {/* ───────── 1단계: trace ───────── */}
      {!traceResult && (
        <div className="space-y-3">
          <Button onClick={handleStartTrace} disabled={trace.status === "streaming"}>
            {trace.status === "streaming" ? "약점 분석 중..." : "면접 질문으로 약점 분석하기"}
          </Button>
          {trace.status === "streaming" && (
            <div className="flex items-center gap-3 py-2">
              <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
              <span className="text-xs text-muted-foreground">
                면접 질문 {interview.questions.length}개의 의도를 자소서와 매칭 중...
              </span>
            </div>
          )}
          {trace.status === "error" && (
            <p className="text-sm text-destructive">{friendlyError(trace.error)}</p>
          )}
          {traceParseFailed && (
            <p className="text-sm text-muted-foreground">
              약점 분석 결과를 해석하지 못했습니다. 다시 시도해보세요.
            </p>
          )}
        </div>
      )}

      {/* ───────── 약점 카드 + 선택 ───────── */}
      {traceResult && !refineResult && (
        <FadeIn>
          <div className="space-y-5">
            <div className="bg-card border-l-4 border-foreground p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold mb-2">
                총평
              </p>
              <p className="text-sm leading-relaxed">{traceResult.overallDiagnosis}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
                  추출된 약점 {traceResult.weaknesses.length}개 · 선택 {selectedIds.size}개
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(new Set(traceResult.weaknesses.map((w) => w.id)))
                    }
                    className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    전체 선택
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    전체 해제
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {traceResult.weaknesses.map((w) => {
                  const checked = selectedIds.has(w.id);
                  return (
                    <label
                      key={w.id}
                      className={`bg-card border-2 p-4 space-y-2 cursor-pointer transition-all duration-75 ${
                        checked
                          ? "border-secondary"
                          : "border-foreground/10 hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleWeakness(w.id)}
                          className="mt-1 accent-secondary"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                              {w.id}
                            </span>
                            {w.relatedHeading && (
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 uppercase tracking-wider text-muted-foreground">
                                {w.relatedHeading}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium leading-snug">{w.summary}</p>
                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                            → {w.suggestion}
                          </p>
                          <details className="text-[11px] text-muted-foreground">
                            <summary className="cursor-pointer">근거 면접 질문 보기</summary>
                            <p className="mt-1.5 pl-2 border-l-2 border-border/40">
                              <span className="font-semibold">Q. </span>
                              {w.evidenceQuestion}
                            </p>
                            <p className="mt-1 pl-2 border-l-2 border-border/40">
                              <span className="font-semibold">의도: </span>
                              {w.evidenceIntent}
                            </p>
                          </details>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleStartRefine}
                disabled={refine.status === "streaming" || selectedIds.size === 0}
              >
                {refine.status === "streaming"
                  ? "자소서 보강 중..."
                  : `선택한 ${selectedIds.size}개 약점으로 자소서 보강하기`}
              </Button>
              {refine.status === "streaming" && (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-2.5 w-2.5 bg-secondary animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    선택한 약점 기준으로 v1 생성 중 (10~20초)...
                  </span>
                </div>
              )}
              {refine.status === "error" && (
                <p className="text-sm text-destructive">{friendlyError(refine.error)}</p>
              )}
              {refineParseFailed && (
                <p className="text-sm text-muted-foreground">
                  자소서 v1 결과를 해석하지 못했습니다. 다시 시도해보세요.
                </p>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ───────── 3단계: diff 뷰 ───────── */}
      {refineResult && traceResult && (
        <FadeIn>
          <div className="bg-card border-2 border-foreground/10 p-6 space-y-6">
            <CoverLetterDiffView
              v0={v0}
              v1={refineResult.revised}
              weaknesses={traceResult.weaknesses}
              changeNotes={refineResult.changeNotes}
              appliedWeaknessIds={refineResult.appliedWeaknessIds}
            />
            <div className="pt-4 border-t border-border/30 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRefineResult(null);
                  refine.reset();
                }}
              >
                약점 다시 선택
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTraceResult(null);
                  setRefineResult(null);
                  setSelectedIds(new Set());
                  trace.reset();
                  refine.reset();
                }}
              >
                처음부터 다시
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="absolute bottom-4 right-8 opacity-[0.03] select-none pointer-events-none">
        <span className="font-heading italic font-black text-7xl">TRACE</span>
      </div>
    </div>
  );
}
