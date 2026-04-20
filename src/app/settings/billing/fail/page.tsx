"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function FailInner() {
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message") ?? "결제가 취소되었거나 실패했어요.";

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-destructive">결제 실패</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      {code && (
        <p className="mt-1 text-[11px] text-muted-foreground">코드: {code}</p>
      )}
      <Link
        href="/settings/billing"
        className="mt-6 inline-block rounded-md border border-border px-5 py-2 text-sm text-foreground hover:bg-muted transition"
      >
        다시 시도
      </Link>
    </main>
  );
}

export default function BillingFailPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16 text-center" />}>
      <FailInner />
    </Suspense>
  );
}
