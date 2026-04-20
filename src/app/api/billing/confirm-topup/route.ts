import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { findTopupPack } from "@/lib/billing/plans";
import { addCredits } from "@/lib/billing/credits";
import { confirmPayment } from "@/lib/billing/toss/checkout";
import { TossError } from "@/lib/billing/toss/client";

const Body = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
  packId: z.string().min(1),
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
  const { paymentKey, orderId, amount, packId } = parsed.data;

  // orderId 소유권 확인 — 서버 발급 형식 `topup_${userId}_${packId}_${random}`
  if (!orderId.startsWith(`topup_${user.id}_${packId}_`)) {
    return NextResponse.json({ error: "orderId 불일치" }, { status: 400 });
  }

  // 서버 plan 테이블 재검증 (amount 변조 방지)
  const pack = findTopupPack(packId);
  if (!pack || pack.amount !== amount) {
    return NextResponse.json({ error: "충전팩 검증 실패" }, { status: 400 });
  }

  const admin = createSupabaseServiceRoleClient();

  // 멱등성: paymentKey 이미 처리됐으면 Toss confirm 재호출 skip.
  // 단 크레딧 지급은 크래시 복구 시나리오 대비 항상 시도 — SP 가 (ref_id, reason) 중복 제약으로 no-op 보장
  const { data: existing } = await admin
    .from("payments")
    .select("payment_key")
    .eq("payment_key", paymentKey)
    .maybeSingle();

  if (!existing) {
    let confirmed;
    try {
      confirmed = await confirmPayment({ paymentKey, orderId, amount });
    } catch (err) {
      if (err instanceof TossError) {
        return NextResponse.json(
          { error: `결제 승인 실패: ${err.message}`, code: err.code },
          { status: 502 },
        );
      }
      throw err;
    }

    await admin.from("payments").upsert({
      payment_key: confirmed.paymentKey,
      user_id: user.id,
      type: "credit_topup",
      plan: null,
      credit_amount: pack.credits,
      amount: confirmed.totalAmount,
      status: confirmed.status,
      order_id: orderId,
      raw: confirmed as unknown as Record<string, unknown>,
    });
  }

  // 재시도/크래시 복구: payments 존재해도 credit_transactions 누락 가능성 → 멱등 call
  const granted = await addCredits(user.id, pack.credits, "purchase", paymentKey);

  return NextResponse.json({
    ok: true,
    credits: pack.credits,
    duplicate: !granted,
  });
}
