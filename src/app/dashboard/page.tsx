"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// 대시보드는 크롤링을 직접 수행하지 않고 /analyze 페이지로 URL만 전달.
// 긴 크롤/분석은 /analyze에서 진행 상황을 보여주는 게 UX에 맞음.
import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion";
import { Search, Target, FileText, MessageCircle, Sparkles, BookOpen, Lightbulb, Clock } from "lucide-react";
import { loadHistory } from "@/lib/storage/match-history";
import type { MatchHistoryEntry } from "@/types";

function scoreColor(score: number): string {
  if (score >= 80) return "text-accent";
  if (score >= 60) return "text-secondary";
  if (score >= 40) return "text-foreground";
  return "text-destructive";
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

/* ─── 공지사항 데이터 ─── */
const ANNOUNCEMENTS = [
  {
    date: "2026-04-16",
    badge: "NEW",
    title: "JobScout v1.0 정식 출시",
    content: "AI 기반 채용공고 분석, 프로필 매칭, 자소서 초안, 면접 예상질문 기능을 제공합니다.",
  },
  {
    date: "2026-04-15",
    badge: "UPDATE",
    title: "UI 전면 리디자인",
    content: "Neo-Academic Pixel 디자인 시스템을 적용하여 시각적 완성도를 높였습니다.",
  },
  {
    date: "2026-04-14",
    badge: "FIX",
    title: "스트리밍 안정성 개선",
    content: "SSE 스트리밍 중 raw JSON이 노출되던 문제를 수정하고 캐싱을 추가했습니다.",
  },
];

/* ─── 기능 카드 데이터 ─── */
const FEATURE_CARDS = [
  {
    href: "/analyze",
    icon: Search,
    label: "MODULE_001",
    title: "채용공고 분석",
    description: "채용공고 URL이나 텍스트를 입력하면 필수/우대 스킬, 직무 요약, 회사 정보를 자동 추출합니다.",
    dark: false,
    span: "md:col-span-7",
  },
  {
    href: "/match",
    icon: Target,
    label: "MODULE_002",
    title: "프로필 매칭",
    description: "내 스킬과 채용공고를 비교하여 적합도 점수, 강점, 보완점을 분석합니다.",
    dark: true,
    span: "md:col-span-5",
  },
  {
    href: "/cover-letter",
    icon: FileText,
    label: "MODULE_003",
    title: "자소서 초안",
    description: "채용공고와 프로필을 기반으로 맞춤형 자기소개서 초안을 AI가 생성합니다.",
    dark: false,
    span: "md:col-span-5",
  },
  {
    href: "/interview",
    icon: MessageCircle,
    label: "MODULE_004",
    title: "면접 예상질문",
    description: "기술/인성/상황별 예상 질문과 모범 답변을 생성하여 면접을 준비합니다.",
    dark: false,
    span: "md:col-span-7",
  },
];

/* ─── 사용 팁 데이터 ─── */
const TIPS = [
  {
    icon: Sparkles,
    title: "URL로 바로 분석",
    content: "원티드, 사람인, 점핏 등 주요 채용 사이트의 URL을 붙여넣으면 자동으로 크롤링합니다.",
  },
  {
    icon: BookOpen,
    title: "프로필을 먼저 등록하세요",
    content: "프로필 매칭에서 내 스킬과 경력을 입력하면 모든 분석에 자동 반영됩니다.",
  },
  {
    icon: Lightbulb,
    title: "자소서 → 면접 순서로",
    content: "채용공고 분석 후 자소서를 먼저 작성하면 면접 질문이 더 구체적으로 생성됩니다.",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [recentHistory, setRecentHistory] = useState<MatchHistoryEntry[]>([]);

  useEffect(() => {
    setRecentHistory(loadHistory().slice(0, 5));
  }, []);

  const handleReopenMatch = useCallback(
    (entry: MatchHistoryEntry) => {
      sessionStorage.setItem("jobscout:jdText", entry.jdText);
      if (entry.jobUrl || entry.jobTitle) {
        sessionStorage.setItem(
          "jobscout:crawlMeta",
          JSON.stringify({
            title: entry.jobTitle,
            company: entry.companyName,
            url: entry.jobUrl ?? "",
          }),
        );
      }
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
      router.push("/match");
    },
    [router],
  );

  const handleUrlSubmit = useCallback(() => {
    if (!url.trim()) return;
    // 이전 분석 캐시 정리 후 analyze 페이지로 URL을 실어서 이동
    sessionStorage.removeItem("jobscout:analyzeResult");
    sessionStorage.removeItem("jobscout:coverLetterResult");
    sessionStorage.removeItem("jobscout:interviewResult");
    sessionStorage.removeItem("jobscout:jdText");
    sessionStorage.removeItem("jobscout:crawlMeta");
    sessionStorage.removeItem("jobscout:focusPosition");
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  }, [url, router]);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <AppShell ribbonLeft="대시보드" ribbonRight="v1.0">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* ─── 환영 헤더 ─── */}
        <FadeIn>
          <div className="dot-matrix-texture p-8 border-2 border-primary/10">
            <p className="text-xs text-secondary uppercase tracking-[0.2em] font-bold mb-2">
              {today}
            </p>
            <h1 className="font-heading text-5xl md:text-6xl text-primary font-black tracking-tighter leading-none">
              대시보드
            </h1>
            <p className="mt-3 text-muted-foreground text-lg">
              채용공고를 분석하고 취업 준비를 시작하세요.
            </p>
          </div>
        </FadeIn>

        {/* ─── 빠른 시작 ─── */}
        <FadeIn delay={0.05}>
          <div className="bg-primary text-primary-foreground p-8 border-4 border-primary">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-secondary" />
              <span className="text-xs uppercase tracking-[0.2em] text-primary-foreground/60 font-bold">
                빠른 시작
              </span>
            </div>
            <h2 className="font-heading text-2xl font-black mb-6">
              채용공고 URL을 입력하세요
            </h2>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-primary-foreground/10 border-b-2 border-primary-foreground/20 focus:border-secondary outline-none py-3 px-4 text-primary-foreground placeholder:text-primary-foreground/30 transition-colors"
                placeholder="https://www.wanted.co.kr/wd/123456"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim()}
                className="bg-secondary text-secondary-foreground px-8 py-3 text-sm uppercase tracking-widest font-bold hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                분석 시작 →
              </button>
            </div>
          </div>
        </FadeIn>

        {/* ─── 최근 매칭 ─── */}
        {recentHistory.length > 0 && (
          <FadeIn delay={0.08}>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="font-heading text-3xl text-primary font-black tracking-tight flex items-center gap-3">
                    <Clock className="w-6 h-6 text-secondary" />
                    최근 매칭
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    클릭해서 분석 결과를 다시 볼 수 있어요
                  </p>
                </div>
                <Link
                  href="/history"
                  className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4"
                >
                  전체 {loadHistory().length}개 →
                </Link>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {recentHistory.map((entry) => (
                  <li key={entry.id}>
                    <button
                      onClick={() => handleReopenMatch(entry)}
                      className="w-full p-4 bg-card border-2 border-foreground/10 hover:border-secondary text-left transition-all duration-75 hover:-translate-y-0.5"
                    >
                      <div className={`font-heading font-black text-3xl tabular-nums ${scoreColor(entry.matchResult.score)}`}>
                        {entry.matchResult.score}
                      </div>
                      <p className="mt-2 text-sm font-bold line-clamp-1">{entry.companyName}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {entry.jobTitle}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {relativeTime(entry.savedAt)} · {entry.profileLabel}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        )}

        {/* ─── 기능 가이드 ─── */}
        <FadeIn delay={0.1}>
          <div className="space-y-4">
            <h2 className="font-heading text-3xl text-primary font-black tracking-tight">
              분석 도구
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {FEATURE_CARDS.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`${card.span} ${
                    card.dark
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border-2 border-primary/10 hover:border-secondary/50"
                  } p-8 transition-all duration-75 hover:translate-y-[-2px] group`}
                >
                  <div className="flex justify-between items-start mb-8">
                    <card.icon className={`w-7 h-7 ${card.dark ? "text-secondary" : "text-secondary"}`} />
                    <span className={`text-[10px] uppercase tracking-widest ${card.dark ? "text-primary-foreground/40" : "text-primary/40"}`}>
                      {card.label}
                    </span>
                  </div>
                  <h3 className="font-heading text-3xl mb-2">{card.title}</h3>
                  <p className={`text-sm ${card.dark ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ─── 공지사항 ─── */}
        <FadeIn delay={0.15}>
          <div className="space-y-4">
            <h2 className="font-heading text-3xl text-primary font-black tracking-tight">
              공지사항
            </h2>
            <div className="space-y-3">
              {ANNOUNCEMENTS.map((notice, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          notice.badge === "NEW"
                            ? "default"
                            : notice.badge === "UPDATE"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {notice.badge}
                      </Badge>
                      <CardTitle>{notice.title}</CardTitle>
                      <span className="ml-auto text-[10px] text-muted-foreground tracking-wider">
                        {notice.date}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{notice.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* ─── 사용 팁 ─── */}
        <FadeIn delay={0.2}>
          <div className="space-y-4">
            <h2 className="font-heading text-3xl text-primary font-black tracking-tight">
              사용 팁
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="pixel-dashed-border p-6 bg-muted/50 space-y-3"
                >
                  <tip.icon className="w-6 h-6 text-secondary" />
                  <h3 className="font-heading text-lg font-bold text-primary">
                    {tip.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tip.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </AppShell>
  );
}
