"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser, useSupabase } from "@/components/supabase-provider";
import { emitCreditsChanged } from "@/lib/storage/events";

function BillingSuccessInner() {
  const params = useSearchParams();
  const user = useUser();
  const { loading: sessionLoading } = useSupabase();
  const once = useRef(false);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "unauth">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    const type = params.get("type");

    async function run() {
      try {
        if (type === "subscription") {
          const authKey = params.get("authKey");
          const customerKey = params.get("customerKey");
          const plan = params.get("plan");
          if (!authKey || !customerKey || !plan) throw new Error("필수 파라미터 누락");

          const res = await fetch("/api/billing/issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authKey, customerKey, plan }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            creditsGranted?: number;
            plan?: string;
          };
          if (!res.ok) throw new Error(body.error ?? "구독 처리 실패");
          setStatus("ok");
          setMessage(
            `${body.plan ?? plan} 플랜 구독이 시작됐어요. ${body.creditsGranted ?? 0} 크레딧이 지급됐어요.`,
          );
          emitCreditsChanged();
        } else if (type === "topup") {
          const paymentKey = params.get("paymentKey");
          const orderId = params.get("orderId");
          const amountStr = params.get("amount");
          const packId = params.get("packId");
          if (!paymentKey || !orderId || !amountStr || !packId)
            throw new Error("필수 파라미터 누락");

          const res = await fetch("/api/billing/confirm-topup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount: Number(amountStr),
              packId,
            }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            credits?: number;
          };
          if (!res.ok) throw new Error(body.error ?? "충전 처리 실패");
          setStatus("ok");
          setMessage(`충전 완료! ${body.credits ?? 0} 크레딧이 추가됐어요.`);
          emitCreditsChanged();
        } else {
          throw new Error("알 수 없는 결제 타입");
        }
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "결제 처리 실패");
      }
    }

    if (sessionLoading) return;
    if (!user) {
      once.current = false;
      setStatus("unauth");
      return;
    }
    void run();
  }, [params, user, sessionLoading]);

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {status === "loading" && (
        <>
          <p className="text-sm text-muted-foreground">결제를 확인하고 있어요...</p>
        </>
      )}
      {status === "ok" && (
        <>
          <h1 className="text-xl font-bold text-foreground">결제 완료</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <Link
            href="/home"
            className="mt-6 inline-block rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition"
          >
            홈으로
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-xl font-bold text-destructive">처리 실패</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <Link
            href="/settings/billing"
            className="mt-6 inline-block rounded-md border border-border px-5 py-2 text-sm text-foreground hover:bg-muted transition"
          >
            결제 설정으로
          </Link>
        </>
      )}
      {status === "unauth" && (
        <>
          <h1 className="text-xl font-bold text-foreground">로그인이 필요해요</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            결제 정보는 계정 단위로 기록되어요. 같은 계정으로 로그인 후 재시도해주세요.
          </p>
          <Link
            href={`/auth/login?next=${encodeURIComponent(
              typeof window === "undefined" ? "/home" : window.location.pathname + window.location.search,
            )}`}
            className="mt-6 inline-block rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-foreground"
          >
            로그인
          </Link>
        </>
      )}
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16 text-center" />}>
      <BillingSuccessInner />
    </Suspense>
  );
}
