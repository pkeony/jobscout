import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * 토스페이먼츠 웹훅 수신.
 *  - signature 검증 (TOSS_WEBHOOK_SECRET 설정된 경우)
 *  - payments.payment_key 로 멱등 upsert → status 갱신만
 *  - 크레딧 지급/차감 같은 side-effect 는 /api/billing/* 엔트리에서 1회 수행,
 *    웹훅은 상태 동기화 용도 (재청구 결과 반영 등)
 */
export async function POST(req: Request) {
  const secret = process.env.TOSS_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[webhook] TOSS_WEBHOOK_SECRET 미설정 → 프로덕션 거부");
      return NextResponse.json({ error: "misconfigured" }, { status: 500 });
    }
    console.warn("[webhook] TOSS_WEBHOOK_SECRET 미설정 — 개발 환경에서만 서명 검증 스킵");
  } else {
    const signature = req.headers.get("toss-signature") ?? "";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    if (signature !== expected) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const paymentKey = typeof payload.paymentKey === "string" ? payload.paymentKey : null;
  const status = typeof payload.status === "string" ? payload.status : null;

  if (!paymentKey) {
    // 결제 외 이벤트 (예: 빌링키 만료 등) — 현재는 무시
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createSupabaseServiceRoleClient();

  // 0 rows 업데이트는 error 없이 성공하므로 select 로 실제 반영 여부 확인.
  // 아직 /api/billing/confirm-topup 보다 웹훅이 먼저 도착한 케이스는 정상 (행 없음) — 200 반환으로 토스 재시도 방지
  const { data, error } = await admin
    .from("payments")
    .update({
      status: status ?? "unknown",
      raw: payload,
    })
    .eq("payment_key", paymentKey)
    .select("payment_key");

  if (error) {
    console.error("[webhook] payments update 실패", error);
    return NextResponse.json({ error: "db update 실패" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.warn("[webhook] payments row 없음 — confirm 이전 도착 추정", {
      paymentKey,
      status,
    });
  }

  return NextResponse.json({ ok: true });
}
