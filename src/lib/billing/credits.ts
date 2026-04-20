import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { type CreditReason } from "./plans";

export async function getBalance(userId: string): Promise<number> {
  const sb = createSupabaseServiceRoleClient();
  const { data, error } = await sb
    .from("credit_balances")
    .select("remaining")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.remaining ?? 0;
}

export async function consumeCredit(
  userId: string,
  reason: CreditReason,
  refId?: string,
): Promise<{ ok: true } | { ok: false; reason: "insufficient" }> {
  const sb = createSupabaseServiceRoleClient();
  const { data, error } = await sb.rpc("consume_credit", {
    p_user_id: userId,
    p_amount: 1,
    p_reason: reason,
    p_ref_id: refId ?? null,
  });
  if (error) throw error;
  if (data === "insufficient") return { ok: false, reason: "insufficient" };
  return { ok: true };
}

export async function refundCredit(
  userId: string,
  originalReason: CreditReason,
): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  // ref_id=null — refund 는 멱등 제약 제외. 원인 추적용 metadata 는 delta/reason 으로 충분
  const { error } = await sb.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: 1,
    p_reason: `refund:${originalReason}`,
    p_ref_id: null,
  });
  if (error) throw error;
}

/**
 * 크레딧 지급 — (ref_id, reason) 중복이면 no-op (멱등).
 * @returns true=지급됨, false=이미 지급된 ref (크래시 복구 시나리오에서도 안전)
 */
export async function addCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  refId?: string,
): Promise<boolean> {
  if (amount <= 0) throw new Error("amount must be positive");
  const sb = createSupabaseServiceRoleClient();
  const { data, error } = await sb.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_id: refId ?? null,
  });
  if (error) throw error;
  return data === true;
}

/**
 * 월 크레딧 지급 안전망. cron 실패 시에도 첫 사용 시점에 보정.
 * race-free — DB SP 내부에서 SELECT FOR UPDATE + 조건 판단 + 지급을 원자적으로 처리
 */
export async function grantMonthlyIfDue(userId: string): Promise<number> {
  const sb = createSupabaseServiceRoleClient();
  const { data, error } = await sb.rpc("grant_monthly_if_due", {
    p_user_id: userId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
