"use client";

import { useState } from "react";
import { FadeIn } from "@/components/motion";

interface CrawlMeta {
  title: string;
  company: string;
  url: string;
}

interface Props {
  meta: CrawlMeta;
  positions: string[];
  onSelect: (position: string | null) => void;
  onCancel: () => void;
}

export function PositionPicker({ meta, positions, onSelect, onCancel }: Props) {
  const [manualPosition, setManualPosition] = useState("");
  const hasPositions = positions.length > 0;
  const manualTrimmed = manualPosition.trim();
  const manualValid = manualTrimmed.length >= 2;

  const submitManual = () => {
    if (!manualValid) return;
    onSelect(manualTrimmed);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <FadeIn>
        <div className="p-8 border-2 border-border bg-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 bg-accent" />
            <span className="text-xs text-accent font-bold">
              {hasPositions ? "다중 포지션 감지됨" : "포지션 자동 감지 실패"}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl text-primary font-black tracking-tighter leading-none mb-2">
            {meta.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {meta.company}
            {hasPositions
              ? " · 관심 포지션을 선택하면 해당 포지션만 집중 분석합니다."
              : " · 공고에서 포지션을 자동 추출하지 못했어요. 직접 입력하거나 전체를 그대로 분석할 수 있어요."}
          </p>
        </div>
      </FadeIn>

      {hasPositions && (
        <FadeIn delay={0.05}>
          <ul className="space-y-2">
            {positions.map((position, i) => (
              <li key={`${position}-${i}`}>
                <button
                  onClick={() => onSelect(position)}
                  className="w-full flex items-center gap-4 p-5 bg-card hover:bg-accent/5 border-l-4 border-transparent hover:border-secondary transition-all duration-75 text-left group"
                >
                  <span className="font-black text-2xl text-accent/60 tabular-nums shrink-0 min-w-[2.5rem]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-base text-foreground font-medium">
                    {position}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:text-accent transition-colors">
                    선택 →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </FadeIn>
      )}

      <FadeIn delay={hasPositions ? 0.1 : 0.05}>
        <div className="p-5 border-2 border-dashed border-primary/15 bg-card/50">
          <label
            htmlFor="manual-position"
            className="block text-xs font-bold text-muted-foreground mb-3"
          >
            {hasPositions ? "목록에 없는 포지션 직접 입력" : "관심 포지션 직접 입력"}
          </label>
          <div className="flex gap-2">
            <input
              id="manual-position"
              type="text"
              value={manualPosition}
              onChange={(e) => setManualPosition(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualValid) submitManual();
              }}
              placeholder="예: 백엔드 엔지니어 / Senior iOS Engineer"
              className="flex-1 px-4 py-3 bg-background border border-border focus:border-secondary focus:outline-none text-base"
              maxLength={80}
            />
            <button
              onClick={submitManual}
              disabled={!manualValid}
              className="px-5 py-3 bg-accent text-accent-foreground text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:translate-y-[-2px] transition-transform duration-75"
            >
              분석 →
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            입력한 포지션 기준으로 해당 역할만 집중 추출해 분석합니다.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/40">
          <button
            onClick={() => onSelect(null)}
            className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 transition-colors"
          >
            {hasPositions ? "전체 포지션 한 번에 분석 (권장하지 않음)" : "전체 공고 그대로 분석"}
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            취소
          </button>
        </div>
      </FadeIn>
    </div>
  );
}
