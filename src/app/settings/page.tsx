"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { clearAnalyzeHistory } from "@/lib/storage/analyze-history";
import { clearCoverLetterHistory } from "@/lib/storage/cover-letter-history";
import { clearInterviewHistory } from "@/lib/storage/interview-history";
import { clearHistory as clearMatchHistory } from "@/lib/storage/match-history";
import { clearAllJobMeta } from "@/lib/storage/job-meta";
import { buildJobIndex } from "@/lib/storage/job-index";

export default function SettingsPage() {
  const router = useRouter();
  const [jobCount, setJobCount] = useState<number | null>(null);

  useEffect(() => {
    setJobCount(buildJobIndex().length);
  }, []);

  const handleClearAll = useCallback(() => {
    const ok = window.confirm(
      "모든 공고 · 분석 · 매칭 · 자소서 · 면접 히스토리와 공고 메타(상태·메모·마감일)를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?",
    );
    if (!ok) return;
    clearAnalyzeHistory();
    clearMatchHistory();
    clearCoverLetterHistory();
    clearInterviewHistory();
    clearAllJobMeta();
    window.sessionStorage.clear();
    router.replace("/jobs");
  }, [router]);

  return (
    <AppShell ribbonLeft={<>설정</>} ribbonRight={<>JobScout v1.0</>}>
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
            설정
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            데이터 관리 · 앱 정보
          </p>
        </FadeIn>

        <FadeIn delay={0.03}>
          <section className="space-y-4">
            <div className="bg-card border border-border rounded-lg elevation-sm p-6">
              <h2 className="text-lg font-bold mb-1">데이터</h2>
              <p className="text-xs text-muted-foreground mb-5">
                브라우저 localStorage 에 저장되어 있습니다.
                {jobCount !== null && <> · 현재 {jobCount}개 공고</>}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
                <div>
                  <p className="text-sm font-medium">모든 히스토리 삭제</p>
                  <p className="text-xs text-muted-foreground">
                    공고 · 분석 · 매칭 · 자소서 · 면접 · 상태 · 메모 · 마감일
                    모두 제거
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearAll}
                >
                  일괄 삭제
                </Button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg elevation-sm p-6">
              <h2 className="text-lg font-bold mb-1">앱 정보</h2>
              <dl className="mt-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">버전</dt>
                  <dd className="font-mono">1.0.0</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">LLM</dt>
                  <dd>Gemini 2.5 Flash</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">저장소</dt>
                  <dd>localStorage (브라우저)</dd>
                </div>
              </dl>
            </div>
          </section>
        </FadeIn>
      </div>
    </AppShell>
  );
}
