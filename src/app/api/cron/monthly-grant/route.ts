import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { PLAN_CREDITS, type PlanTier } from "@/lib/billing/plans";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") ?? "";
  return bearer === `Bearer ${secret}`;
}

/**
 * 매일 03:00 KST 실행. renewed_at 이 30 일 경과한 active 구독에 월 크레딧 지급.
 * withCredit 의 grantMonthlyIfDue 와 중복 방어를 위해 lazy 판정 동일 로직.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseServiceRoleClient();
  const cutoffIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, credit_balances!inner(renewed_at)")
    .eq("status", "active")
    .lte("credit_balances.renewed_at", cutoffIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let granted = 0;
  const failures: Array<{ userId: string; error: string }> = [];

  for (const row of rows ?? []) {
    const plan = (row as { plan: PlanTier }).plan;
    const userId = (row as { user_id: string }).user_id;
    const amount = PLAN_CREDITS[plan];
    if (!amount) continue;

    const { error: rpcErr } = await admin.rpc("grant_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: "monthly_grant",
      p_ref_id: null,
    });
    if (rpcErr) {
      failures.push({ userId, error: rpcErr.message });
      continue;
    }
    granted++;
  }

  return NextResponse.json({
    ok: true,
    granted,
    failures,
    processedAt: new Date().toISOString(),
  });
}
