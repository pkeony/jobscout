import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export async function GET() {
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

  const admin = createSupabaseServiceRoleClient();

  const [balanceQ, subQ] = await Promise.all([
    admin
      .from("credit_balances")
      .select("remaining, renewed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    remaining: balanceQ.data?.remaining ?? 0,
    renewedAt: balanceQ.data?.renewed_at ?? null,
    plan: subQ.data?.plan ?? "free",
    status: subQ.data?.status ?? "active",
    currentPeriodEnd: subQ.data?.current_period_end ?? null,
    cancelAtPeriodEnd: subQ.data?.cancel_at_period_end ?? false,
  });
}
