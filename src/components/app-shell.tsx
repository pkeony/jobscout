"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MetadataRibbon } from "@/components/metadata-ribbon";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/analyze", label: "채용공고 분석" },
  { href: "/match", label: "프로필 매칭" },
  { href: "/cover-letter", label: "자소서" },
  { href: "/interview", label: "면접 질문" },
  { href: "/profiles", label: "프로필 관리" },
  { href: "/history", label: "매칭 히스토리" },
];

interface AppShellProps {
  children: ReactNode;
  ribbonLeft?: ReactNode;
  ribbonRight?: ReactNode;
}

export function AppShell({
  children,
  ribbonLeft,
  ribbonRight,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* ─── 사이드바 (lg+) ─── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 border-border bg-background lg:flex">
        <div className="border-b border-border p-6">
          <Link href="/" className="block">
            <h2 className="font-heading text-2xl font-black italic text-secondary">
              JobScout
            </h2>
          </Link>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            AI 채용공고 분석기
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-75",
                  isActive
                    ? "bg-secondary text-secondary-foreground font-bold"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-75"
          >
            <span>← HOME</span>
          </Link>
        </div>
      </aside>

      {/* ─── 모바일 상단 바 (lg 미만) ─── */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b-2 border-border bg-background px-4 py-2 lg:hidden">
        <Link href="/">
          <span className="font-heading text-lg font-black italic text-secondary">
            JobScout
          </span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-foreground"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ─── 모바일 메뉴 드롭다운 ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-12 z-20 border-b-2 border-border bg-background p-4 lg:hidden">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors duration-75",
                    isActive
                      ? "bg-secondary text-secondary-foreground font-bold"
                      : "text-foreground/70 hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* ─── 메인 캔버스 ─── */}
      <main className="flex flex-1 flex-col pt-12 lg:ml-64 lg:pt-0">
        <MetadataRibbon className="sticky top-0 z-10 w-full">
          <span>{ribbonLeft}</span>
          <span>{ribbonRight}</span>
        </MetadataRibbon>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
