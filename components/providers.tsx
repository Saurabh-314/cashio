"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/use-auth";
import { FinanceProvider } from "@/hooks/use-finance";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthGuard } from "@/components/layout/auth-guard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AuthProvider>
          <FinanceProvider>
            <AuthGuard>{children}</AuthGuard>
            <Toaster position="top-right" />
          </FinanceProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
