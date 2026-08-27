"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { QuickAdd } from "@/components/forms/quick-add";
import { NoteShortcuts } from "@/components/notes/note-shortcuts";
import { NoteReminders } from "@/components/notes/note-reminders";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const onAi = usePathname().startsWith("/ai");

  return (
    <div className="min-h-dvh bg-background">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-sidebar-border lg:block">
        <Sidebar />
      </div>
      <div className="lg:pl-60">
        <AppHeader />
        <main
          className={cn(
            "px-4 lg:px-10",
            onAi
              ? "flex h-dvh flex-col overflow-hidden pt-16 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4"
              : "pt-[5.5rem] pb-28 lg:pb-12",
          )}
        >
          {children}
        </main>
      </div>
      <MobileNav />
      <QuickAdd />
      <NoteShortcuts />
      <NoteReminders />
    </div>
  );
}
