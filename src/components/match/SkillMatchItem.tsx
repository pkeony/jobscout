"use client";

import { cn } from "@/lib/utils";
import type { SkillMatch } from "@/types";

export function SkillMatchItem({ match }: { match: SkillMatch }) {
  const icon =
    match.status === "match" ? "✓" : match.status === "partial" ? "△" : "✕";

  return (
    <div
      className={cn(
        "border-l-4 p-4 bg-card text-sm",
        match.status === "match" && "border-accent",
        match.status === "partial" && "border-secondary",
        match.status === "gap" && "border-destructive",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "font-mono text-xs font-bold",
            match.status === "match" && "text-accent",
            match.status === "partial" && "text-accent",
            match.status === "gap" && "text-destructive",
          )}
        >
          {icon}
        </span>
        <span className="font-bold">{match.name}</span>
      </div>
      <p className="text-muted-foreground text-xs ml-5">{match.comment}</p>
    </div>
  );
}
