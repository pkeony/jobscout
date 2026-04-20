"use client";

import type { MigrationCounts } from "@/lib/sync/migrate";

interface MigrationPromptProps {
  open: boolean;
  counts: MigrationCounts;
  busy: boolean;
  error: string | null;
  onMigrate: () => void;
  onSkip: () => void;
}

export function MigrationPrompt({
  open,
  counts,
  busy,
  error,
  onMigrate,
  onSkip,
}: MigrationPromptProps) {
  if (!open) return null;

  const rows: Array<{ label: string; value: number }> = [
    { label: "프로필", value: counts.profiles },
    { label: "분석 히스토리", value: counts.analyze },
    { label: "매칭 히스토리", value: counts.match },
    { label: "자소서", value: counts.coverLetter },
    { label: "면접 질문", value: counts.interview },
    { label: "공고 상태", value: counts.jobMeta },
  ].filter((r) => r.value > 0);

  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 elevation-md">
        <h2 className="text-lg font-semibold text-foreground">
          브라우저에 저장된 데이터를 옮길까요?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          비회원으로 저장해둔 {total} 개 항목이 있어요. 계정으로 옮기면 어디서든
          이어서 쓸 수 있어요.
        </p>

        <ul className="mt-4 space-y-1.5 rounded-md border border-border/50 bg-background/50 p-3 text-sm">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between text-foreground"
            >
              <span>{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.value}
              </span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mt-3 text-xs text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={onMigrate}
            disabled={busy}
            className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {busy ? "옮기는 중..." : "옮기기"}
          </button>
        </div>
      </div>
    </div>
  );
}
