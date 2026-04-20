import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import {
  PLAN_PRICES,
  PLAN_CREDITS,
  PLAN_ORDER_NAMES,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import { addCredits } from "@/lib/billing/credits";
import { chargeWithBillingKey, issueBillingKey } from "@/lib/billing/toss/billing";
import { TossError } from "@/lib/billing/toss/client";

const Body = z.object({
  authKey: z.string().min(1),
  customerKey: z.string().min(1),
  plan: z.enum(["pro", "plus"]),
});

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
      { status: 400 },
    );
  }
  const { authKey, customerKey, plan } = parsed.data as {
    authKey: string;
    customerKey: string;
    plan: PaidPlanTier;
  };

  const admin = createSupabaseServiceRoleClient();

  // customerKey 변조 방지 — subscriptions row 의 값과 일치해야 함
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("toss_customer_key")
    .eq("user_id", user.id)
    .maybeSingle();
  if (subErr) {
    return NextResponse.json({ error: "구독 조회 실패" }, { status: 500 });
  }
  if (!sub || sub.toss_customer_key !== customerKey) {
    return NextResponse.json(
      { error: "customerKey 불일치" },
      { status: 400 },
    );
  }

  const amount = PLAN_PRICES[plan];
  const now = new Date();
  const periodStartIso = now.toISOString();
  const periodEndIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const orderId = `sub_${user.id}_${now.toISOString().slice(0, 7)}`;

  let billingKey: string;
  try {
    const issued = await issueBillingKey(authKey, customerKey);
    billingKey = issued.billingKey;
  } catch (err) {
    if (err instanceof TossError) {
      return NextResponse.json(
        { error: `빌링키 발급 실패: ${err.message}`, code: err.code },
        { status: 502 },
      );
    }
    throw err;
  }

  let charge;
  try {
    charge = await chargeWithBillingKey({
      billingKey,
      customerKey,
      amount,
      orderId,
      orderName: PLAN_ORDER_NAMES[plan],
    });
  } catch (err) {
    if (err instanceof TossError) {
      return NextResponse.json(
        { error: `첫 결제 실패: ${err.message}`, code: err.code },
        { status: 502 },
      );
    }
    throw err;
  }

  // payments 기록 (멱등)
  await admin.from("payments").upsert({
    payment_key: charge.paymentKey,
    user_id: user.id,
    type: "subscription",
    plan,
    credit_amount: PLAN_CREDITS[plan],
    amount: charge.totalAmount,
    status: charge.status,
    order_id: orderId,
    raw: charge as unknown as Record<string, unknown>,
  });

  // subscriptions 갱신
  const { error: updErr } = await admin
    .from("subscriptions")
    .update({
      plan,
      status: "active",
      toss_billing_key: billingKey,
      current_period_start: periodStartIso,
      current_period_end: periodEndIso,
      cancel_at_period_end: false,
      failed_charge_count: 0,
    })
    .eq("user_id", user.id);
  if (updErr) {
    return NextResponse.json({ error: "구독 갱신 실패" }, { status: 500 });
  }

  // 크레딧 지급
  await addCredits(user.id, PLAN_CREDITS[plan], "monthly_grant", charge.paymentKey);

  return NextResponse.json({
    ok: true,
    plan,
    creditsGranted: PLAN_CREDITS[plan],
    currentPeriodEnd: periodEndIso,
  });
}
