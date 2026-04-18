"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion";
import {
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
} from "@/lib/storage/match-history";
import {
  clearAnalyzeHistory,
  deleteAnalyzeHistoryEntry,
  loadAnalyzeHistory,
} from "@/lib/storage/analyze-history";
import {
  clearCoverLetterHistory,
  deleteCoverLetterHistoryEntry,
  loadCoverLetterHistory,
} from "@/lib/storage/cover-letter-history";
import {
  clearInterviewHistory,
  deleteInterviewHistoryEntry,
  loadInterviewHistory,
} from "@/lib/storage/interview-history";
import type {
  AnalyzeHistoryEntry,
  CoverLetterHistoryEntry,
  InterviewHistoryEntry,
  MatchHistoryEntry,
} from "@/types";

type Tab = "match" | "analyze" | "cover-letter" | "interview";

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-accent";
  if (score >= 60) return "text-secondary";
  if (score >= 40) return "text-foreground";
  return "text-destructive";
}

function restoreSessionFromAnalyze(entry: AnalyzeHistoryEntry): void {
  sessionStorage.setItem("jobscout:jdText", entry.jdText);
  sessionStorage.setItem(
    "jobscout:crawlMeta",
    JSON.stringify({
      title: entry.jobTitle,
      company: entry.companyName,
      url: entry.jobUrl ?? "",
    }),
  );
  if (entry.focusPosition) {
    sessionStorage.setItem("jobscout:focusPosition", entry.focusPosition);
  } else {
    sessionStorage.removeItem("jobscout:focusPosition");
  }
  sessionStorage.setItem(
    "jobscout:analyzeResult",
    JSON.stringify(entry.analysisResult),
  );
  // 다른 페이지 캐시는 stale일 수 있으니 클리어
  sessionStorage.removeItem("jobscout:coverLetterResult");
  sessionStorage.removeItem("jobscout:interviewResult");
}

function restoreSessionFromMatch(entry: MatchHistoryEntry): void {
  sessionStorage.setItem("jobscout:jdText", entry.jdText);
  sessionStorage.setItem(
    "jobscout:crawlMeta",
    JSON.stringify({
      title: entry.jobTitle,
      company: entry.companyName,
      url: entry.jobUrl ?? "",
    }),
  );
  if (entry.focusPosition) {
    sessionStorage.setItem("jobscout:focusPosition", entry.focusPosition);
  } else {
    sessionStorage.removeItem("jobscout:focusPosition");
  }
  if (entry.analysisResult) {
    sessionStorage.setItem(
      "jobscout:analyzeResult",
      JSON.stringify(entry.analysisResult),
    );
  } else {
    sessionStorage.removeItem("jobscout:analyzeResult");
  }
  sessionStorage.setItem(
    "jobscout:matchResultRestore",
    JSON.stringify(entry.matchResult),
  );
}

function restoreSessionFromCoverLetter(entry: CoverLetterHistoryEntry): void {
  sessionStorage.setItem("jobscout:jdText", entry.jdText);
  sessionStorage.setItem(
    "jobscout:crawlMeta",
    JSON.stringify({
      title: entry.jobTitle,
      company: entry.companyName,
      url: entry.jobUrl ?? "",
    }),
  );
  if (entry.focusPosition) {
    sessionStorage.setItem("jobscout:focusPosition", entry.focusPosition);
  } else {
    sessionStorage.removeItem("jobscout:focusPosition");
  }
  if (entry.analysisResult) {
    sessionStorage.setItem(
      "jobscout:analyzeResult",
      JSON.stringify(entry.analysisResult),
    );
  } else {
    sessionStorage.removeItem("jobscout:analyzeResult");
  }
  sessionStorage.setItem(
    "jobscout:coverLetterResult",
    JSON.stringify(entry.coverLetterResult),
  );
}

function restoreSessionFromInterview(entry: InterviewHistoryEntry): void {
  sessionStorage.setItem("jobscout:jdText", entry.jdText);
  sessionStorage.setItem(
    "jobscout:crawlMeta",
    JSON.stringify({
      title: entry.jobTitle,
      company: entry.companyName,
      url: entry.jobUrl ?? "",
    }),
  );
  if (entry.focusPosition) {
    sessionStorage.setItem("jobscout:focusPosition", entry.focusPosition);
  } else {
    sessionStorage.removeItem("jobscout:focusPosition");
  }
  if (entry.analysisResult) {
    sessionStorage.setItem(
      "jobscout:analyzeResult",
      JSON.stringify(entry.analysisResult),
    );
  } else {
    sessionStorage.removeItem("jobscout:analyzeResult");
  }
  sessionStorage.setItem(
    "jobscout:interviewResult",
    JSON.stringify(entry.interviewResult),
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("match");
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [analyses, setAnalyses] = useState<AnalyzeHistoryEntry[]>([]);
  const [coverLetters, setCoverLetters] = useState<CoverLetterHistoryEntry[]>([]);
  const [interviews, setInterviews] = useState<InterviewHistoryEntry[]>([]);

  const refresh = useCallback(() => {
    setMatches(loadHistory());
    setAnalyses(loadAnalyzeHistory());
    setCoverLetters(loadCoverLetterHistory());
    setInterviews(loadInterviewHistory());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleReopenMatch = (entry: MatchHistoryEntry) => {
    restoreSessionFromMatch(entry);
    router.push("/match");
  };

  const handleReopenAnalyze = (entry: AnalyzeHistoryEntry) => {
    restoreSessionFromAnalyze(entry);
    router.push("/analyze");
  };

  const handleReopenCoverLetter = (entry: CoverLetterHistoryEntry) => {
    restoreSessionFromCoverLetter(entry);
    router.push("/cover-letter");
  };

  const handleReopenInterview = (entry: InterviewHistoryEntry) => {
    restoreSessionFromInterview(entry);
    router.push("/interview");
  };

  const handleDeleteMatch = (id: string) => {
    deleteHistoryEntry(id);
    refresh();
  };

  const handleDeleteAnalyze = (id: string) => {
    deleteAnalyzeHistoryEntry(id);
    refresh();
  };

  const handleDeleteCoverLetter = (id: string) => {
    deleteCoverLetterHistoryEntry(id);
    refresh();
  };

  const handleDeleteInterview = (id: string) => {
    deleteInterviewHistoryEntry(id);
    refresh();
  };

  const handleClearAll = () => {
    const label =
      tab === "match"
        ? "매칭 결과"
        : tab === "analyze"
          ? "분석 결과"
          : tab === "cover-letter"
            ? "자소서"
            : "면접 질문";
    const count =
      tab === "match"
        ? matches.length
        : tab === "analyze"
          ? analyses.length
          : tab === "cover-letter"
            ? coverLetters.length
            : interviews.length;
    if (!confirm(`${label} ${count}개를 모두 삭제할까요?`)) return;
    if (tab === "match") clearHistory();
    else if (tab === "analyze") clearAnalyzeHistory();
    else if (tab === "cover-letter") clearCoverLetterHistory();
    else clearInterviewHistory();
    refresh();
  };

  const currentCount =
    tab === "match"
      ? matches.length
      : tab === "analyze"
        ? analyses.length
        : tab === "cover-letter"
          ? coverLetters.length
          : interviews.length;

  return (
    <AppShell ribbonLeft={<>히스토리</>} ribbonRight={<>{currentCount} / 20</>}>
      <div className="max-w-5xl mx-auto space-y-8">
        <FadeIn>
          <div className="dot-matrix-texture p-8 border-2 border-primary/10">
            <span className="text-xs text-secondary uppercase tracking-[0.2em] font-bold mb-2 inline-block">
              HISTORY
            </span>
            <h1 className="font-heading text-5xl md:text-6xl text-primary font-black tracking-tighter leading-none mb-3">
              히스토리
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              분석·매칭·자소서·면접 결과를 각 최대 20개 자동 저장합니다. 항목 클릭 시 LLM 재호출 없이 결과를 다시 봅니다.
            </p>
          </div>
        </FadeIn>

        {/* ── 탭 ── */}
        <FadeIn delay={0.05}>
          <div className="border-t-4 border-foreground">
            <div className="flex border-b-2 border-border bg-muted/30 flex-wrap">
              <TabButton active={tab === "match"} onClick={() => setTab("match")} label="매칭" count={matches.length} />
              <TabButton active={tab === "analyze"} onClick={() => setTab("analyze")} label="분석" count={analyses.length} />
              <TabButton
                active={tab === "cover-letter"}
                onClick={() => setTab("cover-letter")}
                label="자소서"
                count={coverLetters.length}
              />
              <TabButton
                active={tab === "interview"}
                onClick={() => setTab("interview")}
                label="면접 질문"
                count={interviews.length}
              />
              {currentCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="ml-auto px-4 text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
                >
                  전체 삭제
                </button>
              )}
            </div>

            {tab === "match" && (
              <MatchList entries={matches} onReopen={handleReopenMatch} onDelete={handleDeleteMatch} />
            )}
            {tab === "analyze" && (
              <AnalyzeList entries={analyses} onReopen={handleReopenAnalyze} onDelete={handleDeleteAnalyze} />
            )}
            {tab === "cover-letter" && (
              <CoverLetterList
                entries={coverLetters}
                onReopen={handleReopenCoverLetter}
                onDelete={handleDeleteCoverLetter}
              />
            )}
            {tab === "interview" && (
              <InterviewList
                entries={interviews}
                onReopen={handleReopenInterview}
                onDelete={handleDeleteInterview}
              />
            )}
          </div>
        </FadeIn>
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-xs uppercase tracking-[0.2em] font-bold transition-colors duration-75 ${
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label} <span className="ml-1 tabular-nums opacity-70">({count})</span>
    </button>
  );
}

function MatchList({
  entries,
  onReopen,
  onDelete,
}: {
  entries: MatchHistoryEntry[];
  onReopen: (e: MatchHistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        아직 매칭 결과가 없습니다. /match에서 매칭을 시작하세요.
      </div>
    );
  }
  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.id} className="border-b border-border">
          <div className="p-5 flex items-start gap-4">
            <div
              className={`shrink-0 w-16 h-16 flex items-center justify-center border-2 border-foreground/20 bg-card font-heading font-black text-2xl tabular-nums ${scoreColor(entry.matchResult.score)}`}
            >
              {entry.matchResult.score}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="font-heading text-lg font-bold truncate">{entry.jobTitle}</h3>
                {entry.focusPosition && (
                  <Badge variant="outline" className="text-[10px]">
                    {entry.focusPosition}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{entry.companyName}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground uppercase tracking-widest flex-wrap">
                <span>프로필: {entry.profileLabel}</span>
                <span>·</span>
                <span>{formatDate(entry.savedAt)}</span>
                {entry.jobUrl && (
                  <>
                    <span>·</span>
                    <a
                      href={entry.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground underline decoration-dotted underline-offset-4"
                    >
                      원본 ↗
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onReopen(entry)}>
                다시 보기
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(entry.id)}
                className="text-destructive hover:text-destructive"
              >
                삭제
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnalyzeList({
  entries,
  onReopen,
  onDelete,
}: {
  entries: AnalyzeHistoryEntry[];
  onReopen: (e: AnalyzeHistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        아직 분석 결과가 없습니다. 채용공고를 분석하면 자동으로 저장됩니다.
      </div>
    );
  }
  return (
    <ul>
      {entries.map((entry) => {
        const skillCount = entry.analysisResult.skills?.length ?? 0;
        return (
          <li key={entry.id} className="border-b border-border">
            <div className="p-5 flex items-start gap-4">
              <div className="shrink-0 w-16 h-16 flex flex-col items-center justify-center border-2 border-foreground/20 bg-card">
                <span className="font-heading font-black text-xl tabular-nums text-secondary">
                  {skillCount}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  스킬
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 className="font-heading text-lg font-bold truncate">{entry.jobTitle}</h3>
                  {entry.focusPosition && (
                    <Badge variant="outline" className="text-[10px]">
                      {entry.focusPosition}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{entry.companyName}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground uppercase tracking-widest flex-wrap">
                  <span>{entry.analysisResult.experienceLevel}</span>
                  <span>·</span>
                  <span>{formatDate(entry.savedAt)}</span>
                  {entry.jobUrl && (
                    <>
                      <span>·</span>
                      <a
                        href={entry.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground underline decoration-dotted underline-offset-4"
                      >
                        원본 ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => onReopen(entry)}>
                  다시 보기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(entry.id)}
                  className="text-destructive hover:text-destructive"
                >
                  삭제
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CoverLetterList({
  entries,
  onReopen,
  onDelete,
}: {
  entries: CoverLetterHistoryEntry[];
  onReopen: (e: CoverLetterHistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        아직 자소서 기록이 없습니다. 채용공고 분석 후 자소서를 생성하면 자동으로 저장됩니다.
      </div>
    );
  }
  return (
    <ul>
      {entries.map((entry) => {
        const sectionCount = entry.coverLetterResult.sections.length;
        return (
          <li key={entry.id} className="border-b border-border">
            <div className="p-5 flex items-start gap-4">
              <div className="shrink-0 w-16 h-16 flex flex-col items-center justify-center border-2 border-foreground/20 bg-card">
                <span className="font-heading font-black text-xl tabular-nums text-secondary">
                  {sectionCount}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  섹션
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 className="font-heading text-lg font-bold truncate">
                    {entry.coverLetterResult.companyName}
                  </h3>
                  {entry.focusPosition && (
                    <Badge variant="outline" className="text-[10px]">
                      {entry.focusPosition}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {entry.coverLetterResult.jobTitle}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground uppercase tracking-widest flex-wrap">
                  <span>프로필: {entry.profileLabel}</span>
                  <span>·</span>
                  <span>{formatDate(entry.savedAt)}</span>
                  {entry.jobUrl && (
                    <>
                      <span>·</span>
                      <a
                        href={entry.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground underline decoration-dotted underline-offset-4"
                      >
                        원본 ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => onReopen(entry)}>
                  다시 보기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(entry.id)}
                  className="text-destructive hover:text-destructive"
                >
                  삭제
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function InterviewList({
  entries,
  onReopen,
  onDelete,
}: {
  entries: InterviewHistoryEntry[];
  onReopen: (e: InterviewHistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        아직 면접 질문 기록이 없습니다. 채용공고에서 면접 질문을 생성하면 자동으로 저장됩니다.
      </div>
    );
  }
  return (
    <ul>
      {entries.map((entry) => {
        const qCount = entry.interviewResult.questions.length;
        return (
          <li key={entry.id} className="border-b border-border">
            <div className="p-5 flex items-start gap-4">
              <div className="shrink-0 w-16 h-16 flex flex-col items-center justify-center border-2 border-foreground/20 bg-card">
                <span className="font-heading font-black text-xl tabular-nums text-secondary">
                  {qCount}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  문항
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 className="font-heading text-lg font-bold truncate">{entry.jobTitle}</h3>
                  {entry.focusPosition && (
                    <Badge variant="outline" className="text-[10px]">
                      {entry.focusPosition}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{entry.companyName}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground uppercase tracking-widest flex-wrap">
                  <span>{formatDate(entry.savedAt)}</span>
                  {entry.jobUrl && (
                    <>
                      <span>·</span>
                      <a
                        href={entry.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground underline decoration-dotted underline-offset-4"
                      >
                        원본 ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => onReopen(entry)}>
                  다시 보기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(entry.id)}
                  className="text-destructive hover:text-destructive"
                >
                  삭제
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
