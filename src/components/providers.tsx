"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupabaseProvider } from "@/components/supabase-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </SupabaseProvider>
  );
}
