import "server-only";
import { tossFetch } from "./client";

export interface TossBillingKeyIssueResponse {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  cardCompany?: string;
  cardNumber?: string;
  card?: { issuerCode?: string; acquirerCode?: string; number?: string; cardType?: string };
}

export interface TossBillingChargeResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;
  totalAmount: number;
  approvedAt?: string;
  method?: string;
  card?: unknown;
  [k: string]: unknown;
}

export async function issueBillingKey(authKey: string, customerKey: string) {
  return tossFetch<TossBillingKeyIssueResponse>("/v1/billing/authorizations/issue", {
    method: "POST",
    body: { authKey, customerKey },
  });
}

export async function chargeWithBillingKey(params: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}) {
  return tossFetch<TossBillingChargeResponse>(`/v1/billing/${params.billingKey}`, {
    method: "POST",
    body: {
      customerKey: params.customerKey,
      amount: params.amount,
      orderId: params.orderId,
      orderName: params.orderName,
    },
    idempotencyKey: params.orderId,
  });
}
