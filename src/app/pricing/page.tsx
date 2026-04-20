"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { PlanCard } from "@/components/billing/plan-card";
import { CreditPackCard } from "@/components/billing/credit-pack-card";
import { TOPUP_PACKS, type PaidPlanTier } from "@/lib/billing/plans";
import { useUser } from "@/components/supabase-provider";
import { useBalance } from "@/hooks/use-balance";
import { startBillingAuth, startTopupPayment } from "@/lib/billing/toss/flows";

export default function PricingPage() {
  const router = useRouter();
  const user = useUser();
  const { balance } = useBalance();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPlan(plan: PaidPlanTier) {
    setError(null);
    if (!user) {
      router.push(`/auth/signup?plan=${plan}`);
      return;
    }
    setBusy(plan);
    try {
      await startBillingAuth({ plan, userId: user.id, email: user.email ?? undefined });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "결제 창 오픈 실패");
    }
  }

  async function handleTopup(packId: string) {
    setError(null);
    if (!user) {
      router.push("/auth/login?next=/pricing");
      return;
    }
    setBusy(packId);
    try {
      await startTopupPayment({ packId, userId: user.id, email: user.email ?? undefined });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "결제 창 오픈 실패");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">가격</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          1 크레딧 = 분석·매칭·자소서·면접 LLM 호출 1회. 언제든 취소 가능.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <PlanCard
          plan="free"
          currentPlan={balance?.plan}
          onSelect={() => (user ? router.push("/home") : router.push("/auth/signup"))}
        />
        <PlanCard
          plan="pro"
          currentPlan={balance?.plan}
          highlight
          onSelect={() => handleSelectPlan("pro")}
          busy={busy === "pro"}
        />
        <PlanCard
          plan="plus"
          currentPlan={balance?.plan}
          onSelect={() => handleSelectPlan("plus")}
          busy={busy === "plus"}
        />
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold text-foreground">크레딧 충전팩</h2>
        <p className="mt-1 text-xs text-muted-foreground">구독과 별개로 단건 충전 가능.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {TOPUP_PACKS.map((pack) => (
            <CreditPackCard
              key={pack.id}
              pack={pack}
              onSelect={() => handleTopup(pack.id)}
              busy={busy === pack.id}
            />
          ))}
        </div>
      </section>

      <p className="mt-10 text-center text-[11px] text-muted-foreground">
        구독은 매월 자동 갱신되며 <Link href="/settings/billing" className="underline">결제 설정</Link> 에서 언제든 해지할 수 있어요.
      </p>
    </main>
  );
}
