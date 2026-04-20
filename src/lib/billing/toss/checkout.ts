import "server-only";
import { tossFetch } from "./client";

export interface TossPaymentConfirmResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  totalAmount: number;
  status: string;
  approvedAt?: string;
  method?: string;
  [k: string]: unknown;
}

export async function confirmPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  return tossFetch<TossPaymentConfirmResponse>("/v1/payments/confirm", {
    method: "POST",
    body: params,
    idempotencyKey: params.orderId,
  });
}
