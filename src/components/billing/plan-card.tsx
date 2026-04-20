"use client";

import { PLAN_CREDITS, PLAN_PRICES, PLAN_LABELS, type PlanTier } from "@/lib/billing/plans";

interface PlanCardProps {
  plan: PlanTier;
  currentPlan?: PlanTier;
  highlight?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  busy?: boolean;
}

const PLAN_DESCRIPTION: Record<PlanTier, string> = {
  free: "가입만으로 매월 5 크레딧",
  pro: "매월 100 크레딧 · 개인 구직자 추천",
  plus: "매월 400 크레딧 · 다수 공고 비교",
};

export function PlanCard({
  plan,
  currentPlan,
  highlight,
  onSelect,
  disabled,
  busy,
}: PlanCardProps) {
  const isCurrent = currentPlan === plan;
  const price = PLAN_PRICES[plan];

  return (
    <div
      className={`flex flex-col rounded-xl border p-5 transition ${
        highlight
          ? "border-accent bg-accent/5 shadow-md"
          : "border-border bg-card"
      }`}
    >
      {highlight && (
        <span className="mb-2 self-start rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
          추천
        </span>
      )}
      <h3 className="text-lg font-semibold text-foreground">{PLAN_LABELS[plan]}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{PLAN_DESCRIPTION[plan]}</p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-foreground">
          {price === 0 ? "₩0" : `₩${price.toLocaleString()}`}
        </span>
        {price > 0 && <span className="text-xs text-muted-foreground">/월</span>}
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <li>· 월 {PLAN_CREDITS[plan]} 크레딧 자동 지급</li>
        <li>· 1 크레딧 = LLM 분석 1건 (분석·매칭·자소서·면접 공통)</li>
        {plan !== "free" && <li>· 충전팩 추가 구매 가능</li>}
        {plan === "plus" && <li>· 다수 공고 동시 비교에 적합</li>}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={disabled || busy || isCurrent}
        className={`mt-5 w-full rounded-md px-4 py-2 text-sm font-medium transition ${
          isCurrent
            ? "bg-muted text-muted-foreground cursor-default"
            : highlight
              ? "bg-accent text-accent-foreground hover:bg-accent/90"
              : "border border-border bg-background text-foreground hover:bg-muted"
        } ${disabled || busy ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {isCurrent ? "현재 플랜" : busy ? "처리 중..." : plan === "free" ? "무료 시작" : "구독 시작"}
      </button>
    </div>
  );
}
