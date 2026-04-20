"use client";

import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

function getClientKey(): string {
  const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_TOSS_CLIENT_KEY 누락");
  return key;
}

export async function getTossPayments(customerKey: string) {
  const toss = await loadTossPayments(getClientKey());
  return toss.payment({ customerKey });
}
