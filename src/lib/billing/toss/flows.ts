"use client";

import { getTossPayments } from "./client-loader";
import { findTopupPack, PLAN_ORDER_NAMES, PLAN_PRICES, type PaidPlanTier } from "@/lib/billing/plans";

function origin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

/**
 * 빌링키 발급 플로우 — 유저가 카드 입력 후 successUrl 로 리다이렉트.
 * customerKey 는 user.id 를 그대로 사용 (서버측 subscriptions.toss_customer_key 와 동일).
 */
export async function startBillingAuth(params: {
  plan: PaidPlanTier;
  userId: string;
  email?: string;
}): Promise<void> {
  const payment = await getTossPayments(params.userId);
  const successUrl = new URL(`${origin()}/settings/billing/success`);
  successUrl.searchParams.set("type", "subscription");
  successUrl.searchParams.set("plan", params.plan);

  await payment.requestBillingAuth({
    method: "CARD",
    successUrl: successUrl.toString(),
    failUrl: `${origin()}/settings/billing/fail`,
    customerEmail: params.email,
  });
}

/**
 * 단건 충전팩 결제 — successUrl 로 리다이렉트 되면 confirm-topup 호출.
 */
export async function startTopupPayment(params: {
  packId: string;
  userId: string;
  email?: string;
}): Promise<void> {
  const pack = findTopupPack(params.packId);
  if (!pack) throw new Error("알 수 없는 충전팩");

  const payment = await getTossPayments(params.userId);
  // 서버가 검증하는 orderId 형식: topup_${userId}_${packId}_${random}
  const orderId = `topup_${params.userId}_${pack.id}_${crypto.randomUUID().slice(0, 8)}`;
  const successUrl = new URL(`${origin()}/settings/billing/success`);
  successUrl.searchParams.set("type", "topup");
  successUrl.searchParams.set("packId", pack.id);

  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: pack.amount },
    orderId,
    orderName: pack.label,
    successUrl: successUrl.toString(),
    failUrl: `${origin()}/settings/billing/fail`,
    customerEmail: params.email,
  });
}

// ESLint no-unused warning 회피 — 타입 재export 편의
export type { PaidPlanTier };
export { PLAN_PRICES, PLAN_ORDER_NAMES };
