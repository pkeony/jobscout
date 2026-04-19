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
  { href: "/history", label: "히스토리" },
];

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar lg:flex">
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="block">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              JobScout
            </h2>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            AI 채용공고 분석기
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors duration-100",
                  isActive
                    ? "bg-card text-foreground font-medium elevation-sm"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-100"
          >
            ← 홈으로
          </Link>
        </div>
      </aside>

      {/* ─── 모바일 상단 바 ─── */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-card/80 backdrop-blur border-b border-border px-4 py-2.5 lg:hidden">
        <Link href="/">
          <span className="text-base font-bold tracking-tight text-foreground">
            JobScout
          </span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-foreground rounded-md hover:bg-muted transition-colors"
          aria-label="메뉴"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ─── 모바일 메뉴 ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-12 z-20 bg-card border-b border-border p-3 lg:hidden elevation-md">
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-sm rounded-md transition-colors duration-100",
                    isActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
      <main className="flex flex-1 flex-col pt-12 lg:ml-60 lg:pt-0">
        {(ribbonLeft || ribbonRight) && (
          <MetadataRibbon className="sticky top-0 z-10 w-full">
            <span>{ribbonLeft}</span>
            <span>{ribbonRight}</span>
          </MetadataRibbon>
        )}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
