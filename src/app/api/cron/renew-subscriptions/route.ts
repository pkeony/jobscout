import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  PLAN_CREDITS,
  PLAN_PRICES,
  PLAN_ORDER_NAMES,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import { chargeWithBillingKey } from "@/lib/billing/toss/billing";
import { TossError } from "@/lib/billing/toss/client";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAIL_BEFORE_PAST_DUE = 3;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") ?? "";
  return bearer === `Bearer ${secret}`;
}

/**
 * 매일 04:00 KST. current_period_end 가 경과한 active 구독 처리.
 *  - cancel_at_period_end = true  → plan='free' 다운그레이드
 *  - 아니면 chargeWithBillingKey 재청구
 *    - 성공: 기간 연장 + 월 크레딧 지급 + failed_charge_count = 0
 *    - 실패: failed_charge_count++, 3회 이상이면 status='past_due'
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: subs, error } = await admin
    .from("subscriptions")
    .select(
      "user_id, plan, status, toss_billing_key, toss_customer_key, current_period_end, cancel_at_period_end, failed_charge_count",
    )
    .eq("status", "active")
    .lte("current_period_end", nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let charged = 0;
  let downgraded = 0;
  let pastDue = 0;
  const failures: Array<{ userId: string; error: string }> = [];

  for (const sub of subs ?? []) {
    const row = sub as {
      user_id: string;
      plan: PaidPlanTier | "free";
      toss_billing_key: string | null;
      toss_customer_key: string;
      cancel_at_period_end: boolean;
      failed_charge_count: number;
    };

    if (row.plan === "free") continue;

    // 해지 예약된 구독 → free 로 다운그레이드
    if (row.cancel_at_period_end) {
      await admin
        .from("subscriptions")
        .update({
          plan: "free",
          cancel_at_period_end: false,
          toss_billing_key: null,
          current_period_start: nowIso,
          current_period_end: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
          failed_charge_count: 0,
        })
        .eq("user_id", row.user_id);
      downgraded++;
      continue;
    }

    if (!row.toss_billing_key) {
      failures.push({ userId: row.user_id, error: "no billing key" });
      continue;
    }

    const amount = PLAN_PRICES[row.plan];
    // failed_charge_count 포함 — 동일월 재청구 시 토스 "이미 처리된 주문" 거부 방지
    const attempt = row.failed_charge_count + 1;
    const orderId = `sub_${row.user_id}_${nowIso.slice(0, 7)}_${attempt}`;

    try {
      const charge = await chargeWithBillingKey({
        billingKey: row.toss_billing_key,
        customerKey: row.toss_customer_key,
        amount,
        orderId,
        orderName: PLAN_ORDER_NAMES[row.plan],
      });

      await admin.from("payments").upsert({
        payment_key: charge.paymentKey,
        user_id: row.user_id,
        type: "subscription",
        plan: row.plan,
        credit_amount: PLAN_CREDITS[row.plan],
        amount: charge.totalAmount,
        status: charge.status,
        order_id: orderId,
        raw: charge as unknown as Record<string, unknown>,
      });

      await admin
        .from("subscriptions")
        .update({
          current_period_start: nowIso,
          current_period_end: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
          failed_charge_count: 0,
        })
        .eq("user_id", row.user_id);

      await admin.rpc("grant_credits", {
        p_user_id: row.user_id,
        p_amount: PLAN_CREDITS[row.plan],
        p_reason: "monthly_grant",
        p_ref_id: charge.paymentKey,
      });

      charged++;
    } catch (err) {
      const msg = err instanceof TossError ? `${err.code}: ${err.message}` : String(err);
      const nextCount = row.failed_charge_count + 1;
      const nextStatus = nextCount >= MAX_FAIL_BEFORE_PAST_DUE ? "past_due" : "active";

      await admin
        .from("subscriptions")
        .update({
          failed_charge_count: nextCount,
          status: nextStatus,
        })
        .eq("user_id", row.user_id);

      if (nextStatus === "past_due") pastDue++;
      failures.push({ userId: row.user_id, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    charged,
    downgraded,
    pastDue,
    failures,
    processedAt: nowIso,
  });
}
