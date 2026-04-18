"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion";
import {
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
} from "@/lib/storage/match-history";
import type { MatchHistoryEntry } from "@/types";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-accent";
  if (score >= 60) return "text-secondary";
  if (score >= 40) return "text-foreground";
  return "text-destructive";
}

export default function HistoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<MatchHistoryEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(loadHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleReopen = (entry: MatchHistoryEntry) => {
    // sessionStorage에 jdText/메타/캐시된 결과를 복원하고 /match로 이동.
    // /match는 캐시된 분석 결과로 즉시 done 상태로 그림 — 다시 LLM 호출 없음.
    sessionStorage.setItem("jobscout:jdText", entry.jdText);
    if (entry.jobUrl || entry.jobTitle) {
      sessionStorage.setItem(
        "jobscout:crawlMeta",
        JSON.stringify({
          title: entry.jobTitle,
          company: entry.companyName,
          url: entry.jobUrl ?? "",
        }),
      );
    }
    if (entry.focusPosition) {
      sessionStorage.setItem("jobscout:focusPosition", entry.focusPosition);
    } else {
      sessionStorage.removeItem("jobscout:focusPosition");
    }
    if (entry.analysisResult) {
      sessionStorage.setItem(
        "jobscout:analyzeResult",
        JSON.stringify(entry.analysisResult),
      );
    } else {
      sessionStorage.removeItem("jobscout:analyzeResult");
    }
    sessionStorage.setItem(
      "jobscout:matchResultRestore",
      JSON.stringify(entry.matchResult),
    );
    router.push("/match");
  };

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    refresh();
  };

  const handleClearAll = () => {
    if (!confirm(`매칭 히스토리 ${entries.length}개를 모두 삭제할까요?`)) return;
    clearHistory();
    refresh();
  };

  return (
    <AppShell ribbonLeft={<>매칭 히스토리</>} ribbonRight={<>{entries.length} / 20</>}>
      <div className="max-w-5xl mx-auto space-y-8">
        <FadeIn>
          <div className="dot-matrix-texture p-8 border-2 border-primary/10">
            <span className="text-xs text-secondary uppercase tracking-[0.2em] font-bold mb-2 inline-block">
              HISTORY
            </span>
            <h1 className="font-heading text-5xl md:text-6xl text-primary font-black tracking-tighter leading-none mb-3">
              매칭 히스토리
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              최근 매칭 결과 최대 20개를 자동 저장합니다. 항목을 클릭하면 분석 결과를 다시 볼 수 있어요.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="border-t-4 border-foreground">
            <div className="flex items-center justify-between p-4 border-b-2 border-border bg-muted/30">
              <span className="text-xs uppercase tracking-[0.2em] font-bold">
                저장된 결과 ({entries.length})
              </span>
              {entries.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
                >
                  전체 삭제
                </button>
              )}
            </div>

            {entries.length === 0 && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                아직 매칭 결과가 없습니다. /match에서 매칭을 시작하세요.
              </div>
            )}

            <ul>
              {entries.map((entry) => (
                <li key={entry.id} className="border-b border-border">
                  <div className="p-5 flex items-start gap-4">
                    {/* 점수 */}
                    <div
                      className={`shrink-0 w-16 h-16 flex items-center justify-center border-2 border-foreground/20 bg-card font-heading font-black text-2xl tabular-nums ${scoreColor(entry.matchResult.score)}`}
                    >
                      {entry.matchResult.score}
                    </div>

                    {/* 본문 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-heading text-lg font-bold truncate">
                          {entry.jobTitle}
                        </h3>
                        {entry.focusPosition && (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.focusPosition}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {entry.companyName}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground uppercase tracking-widest">
                        <span>프로필: {entry.profileLabel}</span>
                        <span>·</span>
                        <span>{formatDate(entry.savedAt)}</span>
                        {entry.jobUrl && (
                          <>
                            <span>·</span>
                            <a
                              href={entry.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-foreground underline decoration-dotted underline-offset-4"
                            >
                              원본 ↗
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleReopen(entry)}>
                        다시 보기
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(entry.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </div>
    </AppShell>
  );
}
