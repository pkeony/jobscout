"use client";

import type { TOPUP_PACKS } from "@/lib/billing/plans";

type Pack = (typeof TOPUP_PACKS)[number];

interface CreditPackCardProps {
  pack: Pack;
  onSelect?: () => void;
  busy?: boolean;
  disabled?: boolean;
}

export function CreditPackCard({ pack, onSelect, busy, disabled }: CreditPackCardProps) {
  const perCredit = Math.round(pack.amount / pack.credits);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">{pack.label}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        1 크레딧당 ₩{perCredit.toLocaleString()}
      </p>
      <div className="mt-4 text-xl font-bold text-foreground">
        ₩{pack.amount.toLocaleString()}
      </div>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled || busy}
        className="mt-4 w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? "처리 중..." : "결제하고 충전"}
      </button>
    </div>
  );
}
