"use client";

import { Suspense, useEffect, useMemo, useState } from"react";
import Link from"next/link";
import { useRouter, useSearchParams } from"next/navigation";
import { AppShell } from"@/components/app-shell";
import { FadeIn } from"@/components/motion";
import { Skeleton } from"@/components/ui/skeleton";
import { RefineFromInterviewSection } from"@/components/cover-letter/RefineFromInterviewSection";
import { hashJdText } from"@/lib/storage/job-index";

type V0Source ="auto" |"improved";

function parseSource(raw: string | null): V0Source | undefined {
 if (raw ==="auto" || raw ==="improved") return raw;
 return undefined;
}

function CoverLetterRefineInner() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const [jdText, setJdText] = useState<string | null>(null);

 const initialSource = parseSource(searchParams.get("source"));

 useEffect(() => {
 const text = sessionStorage.getItem("jobscout:jdText");
 if (!text) {
 router.replace("/");
 return;
 }
 setJdText(text);
 }, [router]);

 const backHref = useMemo(() => {
 if (!jdText) return"/jobs";
 return`/jobs/${hashJdText(jdText)}?tab=cover-letter`;
 }, [jdText]);

 if (!jdText) {
 return (
 <main className="flex min-h-screen items-center justify-center">
 <Skeleton className="h-8 w-48" />
 </main>
 );
 }

 return (
 <AppShell
 ribbonLeft={<>자소서 · STAGE 2</>}
 ribbonRight={<>TRACE MODE</>}
 >
 <div className="max-w-6xl mx-auto space-y-0">
 <FadeIn>
 <Link
 href={backHref}
 className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-75 mb-8"
 >
 ← 공고 워크스페이스로
 </Link>
 <div className="mb-12">
 <span className="inline-block bg-accent text-accent-foreground px-2 py-0.5 text-[10px] font-bold mb-4">
 STAGE 2 · 면접 역추적
 </span>
 <h1 className=" text-5xl md:text-7xl font-black text-foreground tracking-tight leading-none mb-4">
 자소서 보강
 </h1>
 <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
 면접 질문이 드러낸 자소서의 약점을 추출해 보강한 v1 을 생성합니다.
 </p>
 </div>
 </FadeIn>

 <FadeIn delay={0.04}>
 <RefineFromInterviewSection
 jdText={jdText}
 initialSource={initialSource}
 />
 </FadeIn>
 </div>
 </AppShell>
 );
}

export default function CoverLetterRefinePage() {
 return (
 <Suspense fallback={null}>
 <CoverLetterRefineInner />
 </Suspense>
 );
}
