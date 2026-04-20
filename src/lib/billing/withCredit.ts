import "server-only";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  consumeCredit,
  grantMonthlyIfDue,
  refundCredit,
} from "./credits";
import type { CreditReason } from "./plans";

export type CreditContext = { userId: string };
type CreditHandler = (
  req: Request,
  ctx: CreditContext,
) => Response | Promise<Response>;

/**
 * 선차감 + 실패 시 refund 가드.
 * 정책:
 *  1) 세션 확인 (없으면 401)
 *  2) grantMonthlyIfDue (cron 안전망, 실패해도 진행)
 *  3) consume_credit SP 로 원자적 차감 — 부족하면 402 {code: "INSUFFICIENT_CREDITS"}
 *  4) handler 실행
 *     - Response.status >= 400 → refund (Zod 400 / OCR 502 / 내부 500 등)
 *     - throw → refund + rethrow
 *  5) SSE 200 스트림 중간 실패는 환불 불가 — 근거: 헤더 이미 전송, done 이벤트 도달률 매우 높음
 */
export function withCredit(reason: CreditReason, handler: CreditHandler) {
  return async (req: Request): Promise<Response> => {
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

    try {
      await grantMonthlyIfDue(user.id);
    } catch (err) {
      console.error("[withCredit] grantMonthlyIfDue failed", err);
    }

    const consumed = await consumeCredit(user.id, reason);
    if (!consumed.ok) {
      return NextResponse.json(
        {
          error: "크레딧이 부족합니다. 결제 설정에서 충전하거나 플랜을 업그레이드해주세요.",
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 },
      );
    }

    try {
      const response = await handler(req, { userId: user.id });
      if (response.status >= 400) {
        await refundCredit(user.id, reason).catch((err) => {
          console.error("[withCredit] refund on error-status failed", err);
        });
      }
      return response;
    } catch (err) {
      await refundCredit(user.id, reason).catch((refundErr) => {
        console.error("[withCredit] refund on throw failed", refundErr);
      });
      throw err;
    }
  };
}
