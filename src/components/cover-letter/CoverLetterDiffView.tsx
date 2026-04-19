"use client";

import { useMemo } from"react";
import { diffWordsWithSpace, type Change } from"diff";
import type {
 CoverLetterResult,
 CoverLetterChangeNote,
 CoverLetterWeakness,
} from"@/types";

const REQUIRED_HEADINGS = ["지원 동기","핵심 역량","성장 경험","입사 후 포부"] as const;

function findSectionByHeading(cl: CoverLetterResult, heading: string) {
 const exact = cl.sections.find((s) => s.heading.trim() === heading);
 if (exact) return exact;
 const prefix = heading.slice(0, 4);
 return cl.sections.find((s) => s.heading.trim().startsWith(prefix));
}

function paragraphsToText(ps: string[]): string {
 return ps.join("\n\n");
}

function DiffParts({ parts }: { parts: Change[] }) {
 return (
 <p className="text-sm leading-relaxed whitespace-pre-line">
 {parts.map((part, i) => {
 if (part.added) {
 return (
 <span
 key={i}
 className="bg-accent/15 text-accent font-semibold underline decoration-secondary/40 decoration-1 underline-offset-2"
 >
 {part.value}
 </span>
 );
 }
 if (part.removed) {
 return (
 <span
 key={i}
 className="bg-destructive/10 text-muted-foreground line-through opacity-60"
 >
 {part.value}
 </span>
 );
 }
 return <span key={i}>{part.value}</span>;
 })}
 </p>
 );
}

export function CoverLetterDiffView({
 v0,
 v1,
 weaknesses,
 changeNotes,
 appliedWeaknessIds,
}: {
 v0: CoverLetterResult;
 v1: CoverLetterResult;
 weaknesses: CoverLetterWeakness[];
 changeNotes: CoverLetterChangeNote[];
 appliedWeaknessIds: string[];
}) {
 const weaknessById = useMemo(
 () => new Map(weaknesses.map((w) => [w.id, w])),
 [weaknesses],
 );

 const sectionDiffs = useMemo(
 () =>
 REQUIRED_HEADINGS.map((heading) => {
 const v0Section = findSectionByHeading(v0, heading);
 const v1Section = findSectionByHeading(v1, heading);
 const v0Text = v0Section ? paragraphsToText(v0Section.paragraphs) :"";
 const v1Text = v1Section ? paragraphsToText(v1Section.paragraphs) :"";
 const parts = diffWordsWithSpace(v0Text, v1Text);
 const notesForSection = changeNotes.filter((n) => n.heading === heading);
 return { heading, parts, notes: notesForSection };
 }),
 [v0, v1, changeNotes],
 );

 return (
 <div className="space-y-8">
 <div className="flex items-center justify-between pb-3 border-b-2 border-border">
 <div>
 <p className="text-[10px] text-accent font-bold mb-1">
 v0 → v1 비교
 </p>
 <h3 className=" text-xl font-bold">
 보강된 자소서 diff
 </h3>
 </div>
 <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
 <span className="flex items-center gap-1.5">
 <span className="inline-block w-3 h-3 bg-accent/15 border border-secondary/40" />
 추가
 </span>
 <span className="flex items-center gap-1.5">
 <span className="inline-block w-3 h-3 bg-destructive/10 border border-destructive/30" />
 삭제
 </span>
 </div>
 </div>

 {sectionDiffs.map((s) => (
 <section key={s.heading} className="space-y-3">
 <h4 className=" text-lg font-bold">
 <span className="text-accent mr-2">§</span>
 {s.heading}
 </h4>
 <DiffParts parts={s.parts} />
 {s.notes.length > 0 && (
 <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
 <p className="text-[10px] text-accent font-bold">
 보강 근거 ({s.notes.length})
 </p>
 {s.notes.map((n, i) => {
 const w = weaknessById.get(n.weaknessId);
 return (
 <div
 key={i}
 className="text-xs bg-muted/50 border-l-2 border-secondary/50 p-3 space-y-1"
 >
 {w && (
 <p className="text-[11px] text-muted-foreground">
 약점 [{n.weaknessId}]: {w.summary}
 </p>
 )}
 <p>
 <span className="font-semibold text-muted-foreground">v0: </span>
 {n.before}
 </p>
 <p>
 <span className="font-semibold text-accent">v1: </span>
 {n.after}
 </p>
 </div>
 );
 })}
 </div>
 )}
 </section>
 ))}

 <div className="pt-4 border-t-2 border-border text-[10px] text-muted-foreground">
 반영된 약점 {appliedWeaknessIds.length}/{weaknesses.length}개
 </div>
 </div>
 );
}
