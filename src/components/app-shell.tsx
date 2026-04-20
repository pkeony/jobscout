"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MetadataRibbon } from "@/components/metadata-ribbon";
import { UserMenu } from "@/components/user-menu";
import { buildJobIndex, type Job } from "@/lib/storage/job-index";
import { onJobsChanged, onInsufficientCredits } from "@/lib/storage/events";
import { InsufficientCreditModal } from "@/components/billing/insufficient-credit-modal";
import {
  JOB_TAB_VALUES,
  JOB_TAB_LABELS,
  isJobTabValue,
  type JobTabValue,
} from "@/lib/jobs/tabs";

interface AppShellProps {
  children: ReactNode;
  ribbonLeft?: ReactNode;
  ribbonRight?: ReactNode;
}

function parseCurrentJobId(pathname: string): string | null {
  const m = pathname.match(/^\/jobs\/([^/]+)/);
  if (!m) return null;
  if (m[1] === "new") return null;
  return m[1];
}

function hasResultForTab(job: Job, tab: JobTabValue): boolean {
  switch (tab) {
    case "analyze":
      return job.hasAnalyze;
    case "match":
      return job.hasMatch;
    case "cover-letter":
      return job.hasCoverLetter;
    case "interview":
      return job.hasInterview;
    case "notes":
      return true;
  }
}

export function AppShell({
  children,
  ribbonLeft,
  ribbonRight,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  const currentJobId = parseCurrentJobId(pathname);

  const refreshJobs = useCallback(() => {
    setJobs(buildJobIndex());
  }, []);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs, pathname]);

  useEffect(() => {
    return onJobsChanged(refreshJobs);
  }, [refreshJobs]);

  const [insufficientOpen, setInsufficientOpen] = useState(false);

  useEffect(() => {
    return onInsufficientCredits(() => setInsufficientOpen(true));
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* ─── 사이드바 (lg+) ─── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-sidebar lg:flex">
        <div className="px-6 pt-7 pb-5">
          <Link href="/home" className="block">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              JobScout
            </h2>
          </Link>
          <p className="mt-1.5 text-xs text-muted-foreground">
            AI 채용공고 분석기
          </p>
        </div>

        <div className="px-4 pb-4">
          <Link
            href="/jobs/new"
            className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground elevation-sm hover:bg-accent/90 transition-colors"
          >
            <span>+</span>
            <span>새 공고</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          <PrimaryNavItem
            href="/home"
            label="메인"
            active={pathname === "/home" || pathname === "/"}
          />

          <JobBoardSection
            pathname={pathname}
            jobs={jobs}
            currentJobId={currentJobId}
          />

          <SecondaryNav pathname={pathname} />
        </nav>

        <div className="border-t border-border/50 px-3 py-3">
          <UserMenu />
        </div>
      </aside>

      {/* ─── 모바일 상단 바 ─── */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-card/80 backdrop-blur border-b border-border px-4 py-2.5 lg:hidden">
        <Link href="/home">
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
        <div className="fixed inset-x-0 top-12 z-20 bg-card border-b border-border p-3 lg:hidden elevation-md max-h-[80vh] overflow-y-auto">
          <div className="mb-3">
            <Link
              href="/jobs/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"
            >
              <span>+</span>
              <span>새 공고</span>
            </Link>
          </div>
          <nav className="space-y-1.5">
            <PrimaryNavItem
              href="/home"
              label="메인"
              active={pathname === "/home" || pathname === "/"}
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <JobBoardSection
              pathname={pathname}
              jobs={jobs}
              currentJobId={currentJobId}
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <SecondaryNav
              pathname={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </nav>
          <div className="mt-3 border-t border-border/50 pt-3">
            <UserMenu onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* ─── 메인 캔버스 ─── */}
      <main className="flex flex-1 flex-col pt-12 lg:ml-72 lg:pt-0">
        {(ribbonLeft || ribbonRight) && (
          <MetadataRibbon className="sticky top-0 z-10 w-full">
            <span>{ribbonLeft}</span>
            <span>{ribbonRight}</span>
          </MetadataRibbon>
        )}
        <div className="flex-1 p-6 sm:p-10 lg:p-14">{children}</div>
      </main>
      <InsufficientCreditModal
        open={insufficientOpen}
        onClose={() => setInsufficientOpen(false)}
      />
    </div>
  );
}

interface PrimaryNavItemProps {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}

function PrimaryNavItem({
  href,
  label,
  active,
  onNavigate,
}: PrimaryNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center px-3.5 py-3 text-sm rounded-md transition-colors",
        active
          ? "bg-card text-foreground font-semibold elevation-sm"
          : "text-foreground hover:bg-card/60",
      )}
    >
      {label}
    </Link>
  );
}

interface JobBoardSectionProps {
  pathname: string;
  jobs: Job[];
  currentJobId: string | null;
  onNavigate?: () => void;
}

function JobBoardSection(props: JobBoardSectionProps) {
  return (
    <Suspense fallback={<JobBoardSectionView {...props} currentTab="analyze" />}>
      <JobBoardSectionInner {...props} />
    </Suspense>
  );
}

function JobBoardSectionInner(props: JobBoardSectionProps) {
  const params = useSearchParams();
  const raw = params.get("tab");
  const currentTab: JobTabValue = raw && isJobTabValue(raw) ? raw : "analyze";
  return <JobBoardSectionView {...props} currentTab={currentTab} />;
}

interface JobBoardSectionViewProps extends JobBoardSectionProps {
  currentTab: JobTabValue;
}

function JobBoardSectionView({
  pathname,
  jobs,
  currentJobId,
  currentTab,
  onNavigate,
}: JobBoardSectionViewProps) {
  const currentJob = currentJobId
    ? jobs.find((j) => j.id === currentJobId) ?? null
    : null;
  const onJobBoardRoute =
    pathname === "/jobs" || pathname.startsWith("/jobs/");
  const boardActive = onJobBoardRoute && !currentJobId;

  return (
    <div>
      <Link
        href="/jobs"
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-between px-3.5 py-3 text-sm rounded-md transition-colors",
          boardActive
            ? "bg-card text-foreground font-semibold elevation-sm"
            : "text-foreground hover:bg-card/60",
        )}
      >
        <span className="font-medium">JOB 보드</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {jobs.length}
        </span>
      </Link>

      {onJobBoardRoute && (
        <>
          {currentJob && (
            <p
              className="mt-2.5 px-3 text-[11px] text-muted-foreground truncate"
              title={`${currentJob.companyName}${
                currentJob.focusPosition ? ` · ${currentJob.focusPosition}` : ""
              }`}
            >
              {currentJob.companyName}
              {currentJob.focusPosition ? ` · ${currentJob.focusPosition}` : ""}
            </p>
          )}

          <ul className="mt-1.5 space-y-0.5">
            {JOB_TAB_VALUES.map((tab) => {
              const done = currentJob ? hasResultForTab(currentJob, tab) : false;
              const tabActive = !!currentJob && currentTab === tab;
              const tabClass = cn(
                "flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                !currentJob
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : tabActive
                    ? "bg-accent/10 text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
              );
              const content = (
                <>
                  <span>{JOB_TAB_LABELS[tab]}</span>
                  {tab !== "notes" && done && (
                    <span
                      className={cn(
                        "text-xs",
                        tabActive ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      ✓
                    </span>
                  )}
                </>
              );
              return (
                <li key={tab}>
                  {currentJob ? (
                    <Link
                      href={`/jobs/${currentJob.id}?tab=${tab}`}
                      onClick={onNavigate}
                      className={tabClass}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className={tabClass}
                      title="공고를 먼저 열어주세요"
                    >
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {!currentJob && (
            <p className="mt-2 px-3 text-[11px] text-muted-foreground">
              {jobs.length === 0
                ? "공고를 먼저 만들어주세요."
                : "공고를 먼저 열어주세요."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface SecondaryNavProps {
  pathname: string;
  onNavigate?: () => void;
}

function SecondaryNav({ pathname, onNavigate }: SecondaryNavProps) {
  const items = [
    { href: "/profiles", label: "프로필" },
    { href: "/settings", label: "설정" },
  ];
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center px-3.5 py-3 text-sm rounded-md transition-colors",
              active
                ? "bg-card text-foreground font-semibold elevation-sm"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
