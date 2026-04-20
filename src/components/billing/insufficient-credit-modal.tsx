"use client";

import Link from "next/link";

interface InsufficientCreditModalProps {
  open: boolean;
  onClose: () => void;
}

export function InsufficientCreditModal({ open, onClose }: InsufficientCreditModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">크레딧이 부족해요</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          LLM 1회당 1 크레딧이 소모됩니다. 충전하거나 플랜을 업그레이드해 계속 이용해주세요.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted transition"
          >
            닫기
          </button>
          <Link
            href="/settings/billing"
            onClick={onClose}
            className="flex-1 rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-accent-foreground hover:bg-accent/90 transition"
          >
            충전 / 업그레이드
          </Link>
        </div>
      </div>
    </div>
  );
}
