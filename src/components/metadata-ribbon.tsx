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
        "bg-card/80 backdrop-blur border-b border-border text-muted-foreground px-5 py-2 text-xs font-medium flex items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}
