"use client";

import { useUser } from "@/components/supabase-provider";

interface UserMenuProps {
  onNavigate?: () => void;
}

export function UserMenu({ onNavigate }: UserMenuProps) {
  const user = useUser();

  if (!user) {
    return (
      <a
        href="/auth/login"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-card/60 hover:text-foreground transition-colors"
      >
        <span className="h-6 w-6 flex items-center justify-center rounded-full bg-muted text-[10px]">
          ?
        </span>
        <span>로그인</span>
      </a>
    );
  }

  const email = user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "U";
  const displayName =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0];

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-2">
      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium text-foreground">
          {displayName}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{email}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          onClick={onNavigate}
          className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="로그아웃"
        >
          나가기
        </button>
      </form>
    </div>
  );
}
