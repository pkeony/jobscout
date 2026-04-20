import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export async function POST() {
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
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (subErr) {
    return NextResponse.json({ error: "구독 조회 실패" }, { status: 500 });
  }
  if (!sub || sub.plan === "free" || sub.status !== "active") {
    return NextResponse.json({ error: "취소할 활성 구독이 없습니다" }, { status: 400 });
  }

  const { error } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "취소 처리 실패" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    effectiveAt: sub.current_period_end,
  });
}
