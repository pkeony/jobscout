import "server-only";

const TOSS_BASE = "https://api.tosspayments.com";

export class TossError extends Error {
  readonly code: string;
  readonly status: number;
  readonly raw: unknown;

  constructor(status: number, code: string, message: string, raw: unknown) {
    super(message);
    this.name = "TossError";
    this.status = status;
    this.code = code;
    this.raw = raw;
  }
}

function getSecretKey(): string {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) throw new Error("TOSS_SECRET_KEY 누락");
  return key;
}

function authHeader(): string {
  const encoded = Buffer.from(`${getSecretKey()}:`).toString("base64");
  return `Basic ${encoded}`;
}

export async function tossFetch<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${TOSS_BASE}${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const body = parsed as { code?: string; message?: string };
    throw new TossError(
      res.status,
      body.code ?? "UNKNOWN",
      body.message ?? `Toss API ${res.status}`,
      parsed,
    );
  }

  return parsed as T;
}
