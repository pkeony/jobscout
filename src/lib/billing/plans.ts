export const PLAN_CREDITS = {
  free: 5,
  pro: 100,
  plus: 400,
} as const;

export const PLAN_PRICES = {
  free: 0,
  pro: 9900,
  plus: 24900,
} as const;

export const PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  plus: "Plus",
} as const;

export const PLAN_ORDER_NAMES = {
  free: "JobScout Free",
  pro: "JobScout Pro (월 구독)",
  plus: "JobScout Plus (월 구독)",
} as const;

export const TOPUP_PACKS = [
  { id: "pack_50", credits: 50, amount: 4900, label: "50 크레딧" },
  { id: "pack_200", credits: 200, amount: 14900, label: "200 크레딧" },
] as const;

export type PlanTier = keyof typeof PLAN_CREDITS;
export type PaidPlanTier = Exclude<PlanTier, "free">;

export type CreditReason =
  | "monthly_grant"
  | "purchase"
  | "refund"
  | "admin"
  | "api_analyze"
  | "api_match"
  | "api_cover_letter"
  | "api_cover_letter_refine"
  | "api_cover_letter_trace"
  | "api_improve_cover_letter"
  | "api_interview"
  | "api_analyze_image";

export function isPaidPlan(plan: PlanTier): plan is PaidPlanTier {
  return plan === "pro" || plan === "plus";
}

export function findTopupPack(packId: string) {
  return TOPUP_PACKS.find((p) => p.id === packId);
}
