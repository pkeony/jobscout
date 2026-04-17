import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetadataRibbonProps {
  children: ReactNode;
  className?: string;
}

export function MetadataRibbon({ children, className }: MetadataRibbonProps) {
  return (
    <div
      data-slot="metadata-ribbon"
      className={cn(
        "bg-accent text-accent-foreground px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] flex items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}
