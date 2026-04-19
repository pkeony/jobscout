"use client";

import { useMemo } from "react";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";
import { PixelProgressRing } from "@/components/pixel-progress-ring";
import { ScoreBreakdownBar } from "@/components/score-breakdown-bar";
import { SkillMatchItem } from "./SkillMatchItem";
import type { MatchResult, SkillMatch } from "@/types";

export function MatchResultView({ result }: { result: MatchResult }) {
  const sortedSkillMatches = useMemo(() => {
    const order: Record<SkillMatch["status"], number> = {
      gap: 0,
      partial: 1,
      match: 2,
    };
    return [...result.skillMatches].sort(
      (a, b) => order[a.status] - order[b.status],
    );
  }, [result.skillMatches]);

  return (
    <div className="space-y-0">
      <FadeIn>
        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12">
          <div className="w-full md:w-2/3">
            <span className="inline-block bg-accent text-accent-foreground px-2 py-0.5 text-[10px] font-bold mb-4">
              매칭 결과
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
              적합도 분석
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              {result.summary}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <PixelProgressRing score={result.score} className="w-48 h-48" />
            {result.scoreBreakdown && (
              <ScoreBreakdownBar breakdown={result.scoreBreakdown} />
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.03}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-12 border-t-4 border-foreground">
          <div className="p-8 border-r-0 md:border-r-2 border-border bg-muted/30">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">강점</h2>
              <span className="text-[10px] text-muted-foreground">보유 역량 매칭</span>
            </div>
            <div className="space-y-4">
              {result.strengths.map((s, i) => (
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
          <div className="p-8 bg-muted">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">보완 필요</h2>
              <span className="text-[10px] text-muted-foreground">갭 분석</span>
            </div>
            <div className="space-y-4">
              {result.gaps.map((g, i) => (
                <div
                  key={i}
                  className="p-4 bg-card/60 border-l-4 border-destructive"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-destructive">
                      갭 {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{g}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.06}>
        <div className="bg-foreground p-1 mb-4">
          <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
            <span className="text-[10px] flex items-center gap-2 text-background/80">
              <span className="w-2 h-2 bg-accent" />
              스킬별 상세 분석
            </span>
          </div>
          <div className="bg-card p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StaggerList className="contents">
                {sortedSkillMatches.map((m) => (
                  <StaggerItem key={m.name}>
                    <SkillMatchItem match={m} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>

            <div className="mt-8 pt-8 border-t border-border/30">
              <h4 className="font-bold text-lg border-b-2 border-secondary pb-1 inline-block mb-4">
                지원 전략
              </h4>
              <p className="text-sm leading-relaxed max-w-3xl">{result.advice}</p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
