"use client";

interface AnalysisProgressProps {
  inputMode: "url" | "text" | "image";
  deltaChars: number;
  crawlTitle?: string;
  phase: "crawling" | "analyzing";
}

export function AnalysisProgress({
  inputMode,
  deltaChars,
  crawlTitle,
  phase,
}: AnalysisProgressProps) {
  const sourceLabel =
    inputMode === "url"
      ? "URL 크롤링"
      : inputMode === "image"
        ? "이미지 OCR"
        : "텍스트 입력";
  const progressRatio = Math.min(0.95, deltaChars / 3500);
  const isCrawling = phase === "crawling";
  const stepOneState = isCrawling ? "active" : "done";
  const stepTwoState = isCrawling ? "pending" : deltaChars > 0 ? "active" : "pending";
  const stepThreeState = progressRatio > 0.85 ? "active" : "pending";
  const bigNum = isCrawling
    ? "01"
    : stepThreeState === "active"
      ? "03"
      : stepTwoState === "active"
        ? "02"
        : "01";

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-12 items-start pt-8">
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 bg-accent animate-pulse" />
            <span className="text-[10px] text-accent font-bold">
              {isCrawling ? "채용공고 수집 중" : "분석 진행 중"}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground leading-none">
            {crawlTitle ?? "채용공고"}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-md leading-relaxed">
            {isCrawling
              ? "채용공고 본문과 포지션 목록을 가져오고 있습니다."
              : "AI가 스킬·자격요건·혜택 등 주요 정보를 추출하고 있습니다."}
          </p>
        </div>

        <ol className="space-y-4">
          <ProgressStep
            num="01"
            label={sourceLabel}
            sub={isCrawling ? "진행 중" : "완료됨"}
            state={stepOneState}
          />
          <ProgressStep
            num="02"
            label="AI 분석"
            sub={
              stepTwoState === "active"
                ? `${deltaChars.toLocaleString()}자 수신 중`
                : isCrawling
                  ? "크롤 완료 대기"
                  : "시작 대기"
            }
            state={stepTwoState}
            progress={stepTwoState === "active" ? progressRatio : undefined}
          />
          <ProgressStep
            num="03"
            label="결과 구성"
            sub="JSON 파싱 및 렌더링"
            state={stepThreeState}
          />
        </ol>
      </div>

      <div className="hidden md:flex justify-center items-center">
        <div className="relative w-48 h-48">
          <div className="absolute inset-0 border-4 border-foreground bg-card" />
          <div className="absolute inset-3 border-2 border-secondary/30 animate-pulse" />
          <div className="absolute inset-6 border border-secondary/50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-black text-7xl text-accent/60 tabular-nums">
              {bigNum}
            </span>
          </div>
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-foreground" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-foreground" />
        </div>
      </div>
    </div>
  );
}

function ProgressStep({
  num,
  label,
  sub,
  state,
  progress,
}: {
  num: string;
  label: string;
  sub: string;
  state: "done" | "active" | "pending";
  progress?: number;
}) {
  if (state === "active") {
    return (
      <li className="bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="font-black text-2xl text-accent tabular-nums">{num}</span>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider uppercase">
              {sub}
            </p>
            {typeof progress === "number" && (
              <div className="mt-4 h-2 w-full bg-muted border border-border overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </li>
    );
  }
  if (state === "done") {
    return (
      <li className="flex items-start gap-4 p-2">
        <span className="font-black text-xl text-muted-foreground tabular-nums">
          {num}
        </span>
        <div className="flex-1">
          <h3 className="font-medium text-base text-foreground/50 line-through">
            {label}
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wider uppercase">
            {sub}
          </p>
        </div>
        <span className="text-accent text-sm tracking-widest">✓</span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-4 p-2 opacity-40">
      <span className="font-black text-xl text-muted-foreground tabular-nums">
        {num}
      </span>
      <div className="flex-1">
        <h3 className="font-medium text-base text-foreground">{label}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wider uppercase">
          {sub}
        </p>
      </div>
    </li>
  );
}
