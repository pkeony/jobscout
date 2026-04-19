"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/file-drop-zone";
import { useStreamingResponse } from "@/hooks/use-streaming-response";
import { downloadCoverLetterAsTxt, flattenCoverLetterToText } from "@/lib/cover-letter-export";
import {
  ImproveCoverLetterResultSchema,
  type AnalysisResult,
  type ImproveCoverLetterResult,
} from "@/types";
import type { StreamEvent } from "@/lib/ai/types";
import { CoverLetterView } from "./CoverLetterView";

function safeParseImprove(text: string): ImproveCoverLetterResult | null {
  if (!text) return null;
  try {
    const parsed = ImproveCoverLetterResultSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

interface Props {
  jdText: string;
  analysisResult?: AnalysisResult;
  focusPosition?: string;
}

export function ImproveSection({ jdText, analysisResult, focusPosition }: Props) {
  const {
    status: improveStatus,
    fullText: improveText,
    error: improveError,
    start: startImprove,
    reset: resetImprove,
  } = useStreamingResponse<StreamEvent>("/api/improve-cover-letter");
  const [improveCopied, setImproveCopied] = useState(false);

  const improveResult = useMemo<ImproveCoverLetterResult | null>(() => {
    if (improveStatus !== "done" || !improveText) return null;
    return safeParseImprove(improveText);
  }, [improveStatus, improveText]);

  // 첨삭 결과를 sessionStorage 에 저장 — Stage 2 (RefineFromInterviewSection) 가 v0 후보로 사용
  useEffect(() => {
    if (!improveResult) return;
    sessionStorage.setItem(
      "jobscout:coverLetterImproveResult",
      JSON.stringify(improveResult.revised),
    );
  }, [improveResult]);

  const improveParseFailed =
    improveStatus === "done" && !improveResult && improveText.length > 0;

  const handleImproveFile = useCallback(
    (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jdText", jdText);
      if (analysisResult) {
        formData.append("analysisResult", JSON.stringify(analysisResult));
      }
      if (focusPosition) {
        formData.append("focusPosition", focusPosition);
      }
      startImprove(formData);
    },
    [jdText, analysisResult, focusPosition, startImprove],
  );

  const handleImproveCopy = useCallback(async () => {
    if (!improveResult) return;
    await navigator.clipboard.writeText(
      flattenCoverLetterToText(improveResult.revised),
    );
    setImproveCopied(true);
    setTimeout(() => setImproveCopied(false), 2000);
  }, [improveResult]);

  if (improveResult) {
    return (
      <div className="border-t-4 border-foreground p-8 space-y-8 bg-muted relative">
        <div className="flex flex-wrap gap-4 justify-between items-end pb-4 border-b-2 border-border">
          <div>
            <p className="text-[10px] text-accent font-bold mb-1">첨삭 완료</p>
            <h2 className="text-3xl font-bold">기존 자소서 개선 결과</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleImproveCopy}>
              {improveCopied ? "복사됨!" : "수정본 복사"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCoverLetterAsTxt(improveResult.revised, "첨삭본")}
            >
              첨삭본 .txt
            </Button>
            <Button variant="ghost" size="sm" onClick={resetImprove}>
              다른 자소서
            </Button>
          </div>
        </div>

        <section className="bg-card p-6 border-l-4 border-foreground">
          <p className="text-[10px] text-accent font-bold mb-2">총평</p>
          <p className="text-sm leading-relaxed">{improveResult.overallComment}</p>
        </section>

        {improveResult.missingFromJd.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] text-accent font-bold">
              채용공고에 있으나 자소서에 빠진 요소 ({improveResult.missingFromJd.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {improveResult.missingFromJd.map((m, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-accent/20 text-accent-foreground px-2 py-1"
                >
                  {m}
                </span>
              ))}
            </div>
          </section>
        )}

        {improveResult.suggestions.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] text-accent font-bold">
              수정 제안 ({improveResult.suggestions.length})
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {improveResult.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="bg-card border border-border/40 p-4 space-y-2.5 flex flex-col"
                >
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {s.heading}
                  </p>
                  <div className="text-xs leading-relaxed space-y-1">
                    <p>
                      <span className="font-semibold text-muted-foreground">원문: </span>
                      {s.original}
                    </p>
                    <p>
                      <span className="font-semibold text-accent">수정: </span>
                      {s.revised}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/30 mt-auto">
                    → {s.reason}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <p className="text-[10px] text-accent font-bold">수정된 전체 자소서</p>
          <div className="bg-card p-8 border-2 border-border">
            <CoverLetterView result={improveResult.revised} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="border-t-4 border-foreground p-8 bg-muted/30">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">기존 자소서 첨삭</h2>
          <p className="text-sm text-muted-foreground">
            이미 작성한 자소서가 있다면 파일을 업로드하여 채용공고 기반 개선 제안을 받아보세요.
          </p>
        </div>

        {improveStatus === "idle" && (
          <FileDropZone
            accept=".pdf,.docx,.txt"
            label="기존 자소서를 드래그하세요"
            description="PDF, DOCX, TXT (5MB 이하)"
            onFile={handleImproveFile}
          />
        )}

        {improveStatus === "streaming" && (
          <div className="flex items-center gap-3 py-8">
            <div className="h-2.5 w-2.5 bg-accent animate-pulse" />
            <span className="text-sm text-muted-foreground">
              자소서 분석 및 개선 제안 작성 중...
            </span>
          </div>
        )}

        {improveStatus === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {improveError ?? "자소서 개선 중 오류가 발생했습니다"}
            </p>
            <Button variant="outline" size="sm" onClick={resetImprove}>
              다시 시도
            </Button>
          </div>
        )}

        {improveParseFailed && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              개선 결과를 해석하지 못했습니다. 다시 시도해보세요.
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">원문 보기</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-card p-3 max-h-80 overflow-auto">
                {improveText}
              </pre>
            </details>
            <Button variant="outline" size="sm" onClick={resetImprove}>
              다시 시도
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
