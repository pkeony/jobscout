"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlanCard } from "@/components/billing/plan-card";
import { useUser } from "@/components/supabase-provider";
import { startBillingAuth } from "@/lib/billing/toss/flows";
import type { PaidPlanTier } from "@/lib/billing/plans";

export default function OnboardingPage() {
  const router = useRouter();
  const user = useUser();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) {
      router.push("/auth/login?next=/onboarding");
    }
  }, [user, router]);

  async function handleSelectPaid(plan: PaidPlanTier) {
    if (!user) return;
    setError(null);
    setBusy(plan);
    try {
      await startBillingAuth({ plan, userId: user.id, email: user.email ?? undefined });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "결제 창 오픈 실패");
    }
  }

  function handleSkip() {
    router.push("/home");
  }

  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-14">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          JobScout 에 오신 걸 환영해요
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          시작할 플랜을 선택해주세요. 나중에 언제든 변경할 수 있어요.
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-md rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <PlanCard plan="free" onSelect={handleSkip} />
        <PlanCard
          plan="pro"
          highlight
          onSelect={() => handleSelectPaid("pro")}
          busy={busy === "pro"}
        />
        <PlanCard
          plan="plus"
          onSelect={() => handleSelectPaid("plus")}
          busy={busy === "plus"}
        />
      </section>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-muted-foreground underline hover:text-foreground transition"
        >
          나중에 고를게요 (무료 시작)
        </button>
      </div>
    </main>
  );
}
