"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/supabase-provider";
import { onCreditsChanged } from "@/lib/storage/events";
import type { PlanTier } from "@/lib/billing/plans";

export interface BalanceState {
  remaining: number;
  plan: PlanTier;
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const FALLBACK: BalanceState = {
  remaining: 0,
  plan: "free",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

export function useBalance(): {
  balance: BalanceState | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const user = useUser();
  const [balance, setBalance] = useState<BalanceState | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/balance", { cache: "no-store" });
      if (!res.ok) {
        setBalance(FALLBACK);
        return;
      }
      const data = (await res.json()) as BalanceState;
      setBalance(data);
    } catch {
      setBalance(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    return onCreditsChanged(() => {
      void refetch();
    });
  }, [refetch]);

  return { balance, loading, refetch };
}
