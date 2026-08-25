"use client";

import { AppHeader } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { QuickAdd } from "@/components/forms/quick-add";
import { NoteShortcuts } from "@/components/notes/note-shortcuts";
import { NoteReminders } from "@/components/notes/note-reminders";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-y-0 left-0 hidden w-60 border-r border-sidebar-border lg:block">
        <Sidebar />
      </div>
      <div className="lg:pl-60">
        <AppHeader />
        <main className="px-4 pt-6 pb-28 lg:px-10 lg:pb-12">{children}</main>
      </div>
      <MobileNav />
      <QuickAdd />
      <NoteShortcuts />
      <NoteReminders />
    </div>
  );
}
