import type { ScoreBreakdown } from"@/types";

type SegmentKey ="requiredSkills" |"preferredSkills" |"experience" |"base";

interface SegmentDef {
 key: SegmentKey;
 label: string;
 color: string;
}

const SEGMENTS: readonly SegmentDef[] = [
 { key:"requiredSkills", label:"필수", color:"bg-accent" },
 { key:"preferredSkills", label:"우대", color:"bg-accent" },
 { key:"experience", label:"경력", color:"bg-foreground" },
 { key:"base", label:"기본", color:"bg-muted-foreground/40" },
];

export function ScoreBreakdownBar({ breakdown }: { breakdown: ScoreBreakdown }) {
 const items = SEGMENTS.map((seg) => {
 if (seg.key ==="base") {
 return { ...seg, earned: breakdown.base, max: breakdown.base };
 }
 const bucket = breakdown[seg.key];
 return { ...seg, earned: bucket.earned, max: bucket.max };
 });
 const totalEarned = items.reduce((sum, it) => sum + it.earned, 0) || 1;

 return (
 <div className="w-48 flex flex-col gap-2">
 <div className="h-4 flex border-2 border-foreground bg-card overflow-hidden">
 {items.map(
 (it) =>
 it.earned > 0 && (
 <div
 key={it.key}
 className={it.color}
 style={{ width:`${(it.earned / totalEarned) * 100}%` }}
 title={`${it.label}: ${it.earned}/${it.max}`}
 />
 ),
 )}
 </div>
 <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
 {items.map((it) => (
 <li key={it.key} className="flex items-center gap-1.5">
 <span className={`w-2 h-2 ${it.color} border border-border`} />
 <span className="text-muted-foreground">{it.label}</span>
 <span className="ml-auto tabular-nums text-foreground/80">
 {it.earned}/{it.max}
 </span>
 </li>
 ))}
 </ul>
 </div>
 );
}
