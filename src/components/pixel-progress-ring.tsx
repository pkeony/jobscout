import { cn } from "@/lib/utils";

interface PixelProgressRingProps {
  score: number;
  className?: string;
}

export function PixelProgressRing({ score, className }: PixelProgressRingProps) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 70
      ? "text-accent"
      : score >= 40
        ? "text-secondary"
        : "text-destructive";

  return (
    <div className={cn("relative w-32 h-32 shrink-0", className)}>
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <rect
          x="4"
          y="4"
          width="112"
          height="112"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted"
        />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="square"
          transform="rotate(-90 60 60)"
          className={scoreColor}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-heading text-3xl font-black italic", scoreColor)}>
          {score}%
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
          적합도
        </span>
      </div>
      {/* Pixel corner accents */}
      <div className="absolute -top-0.5 -left-0.5 w-2 h-2 bg-foreground" />
      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-foreground" />
    </div>
  );
}
