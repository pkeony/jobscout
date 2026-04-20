"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLAN_CREDITS, PLAN_LABELS, PLAN_PRICES, TOPUP_PACKS } from "@/lib/billing/plans";
import { startBillingAuth, startTopupPayment } from "@/lib/billing/toss/flows";
import { useUser } from "@/components/supabase-provider";
import { useBalance } from "@/hooks/use-balance";
import { CreditPackCard } from "@/components/billing/credit-pack-card";

export default function BillingSettingsPage() {
  const router = useRouter();
  const user = useUser();
  const { balance, refetch } = useBalance();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-14 text-center">
        <p className="text-sm text-muted-foreground">로그인이 필요해요.</p>
        <Link
          href="/auth/login?next=/settings/billing"
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          로그인
        </Link>
      </main>
    );
  }

  const plan = balance?.plan ?? "free";
  const remaining = balance?.remaining ?? 0;
  const cancelScheduled = balance?.cancelAtPeriodEnd ?? false;
  const periodEnd = balance?.currentPeriodEnd
    ? new Date(balance.currentPeriodEnd).toLocaleDateString("ko-KR")
    : null;

  async function handleTopup(packId: string) {
    setError(null);
    setMessage(null);
    setBusy(packId);
    try {
      await startTopupPayment({ packId, userId: user!.id, email: user!.email ?? undefined });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "결제 창 오픈 실패");
    }
  }

  async function handleChangePlan(target: "pro" | "plus") {
    setError(null);
    setMessage(null);
    setBusy(target);
    try {
      await startBillingAuth({ plan: target, userId: user!.id, email: user!.email ?? undefined });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "결제 창 오픈 실패");
    }
  }

  async function handleCancel() {
    if (!confirm("정말 구독을 해지할까요? 다음 결제일부터 Free 로 전환됩니다.")) return;
    setError(null);
    setBusy("cancel");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "해지 실패");
      }
      setMessage("해지 예약됐어요. 다음 결제일 이후 Free 로 전환됩니다.");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "해지 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">결제 설정</h1>
      <p className="mt-1 text-sm text-muted-foreground">플랜, 크레딧, 결제수단을 관리해요.</p>

      {error && (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-5 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent">
          {message}
        </div>
      )}

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">현재 플랜</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{PLAN_LABELS[plan]}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">남은 크레딧</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{remaining}</p>
          </div>
        </div>

        {plan !== "free" && (
          <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
            <p>월 {PLAN_CREDITS[plan]} 크레딧 · ₩{PLAN_PRICES[plan].toLocaleString()}/월</p>
            {periodEnd && (
              <p>
                {cancelScheduled ? "해지 예약됨 — " : "다음 결제일: "}
                <span className="text-foreground">{periodEnd}</span>
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {plan === "free" && (
            <>
              <button
                type="button"
                onClick={() => handleChangePlan("pro")}
                disabled={busy !== null}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 transition disabled:opacity-60"
              >
                Pro 구독 시작
              </button>
              <button
                type="button"
                onClick={() => handleChangePlan("plus")}
                disabled={busy !== null}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition disabled:opacity-60"
              >
                Plus 구독 시작
              </button>
            </>
          )}
          {plan === "pro" && (
            <button
              type="button"
              onClick={() => handleChangePlan("plus")}
              disabled={busy !== null}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 transition disabled:opacity-60"
            >
              Plus 로 업그레이드
            </button>
          )}
          {plan !== "free" && !cancelScheduled && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy !== null}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 transition disabled:opacity-60"
            >
              해지하기
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/pricing")}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition"
          >
            모든 플랜 보기
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">크레딧 충전</h2>
        <p className="mt-1 text-xs text-muted-foreground">구독과 별개로 단건 충전 가능해요.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
    </main>
  );
}
