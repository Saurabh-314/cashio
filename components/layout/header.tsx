"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";

export function AppHeader() {
  const { profile } = useAuth();
  const { openQuickAdd } = useFinance();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (profile?.displayName ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed top-0 right-0 left-0 z-30 h-16 border-b border-border bg-background/90 backdrop-blur-md lg:left-60">
      <div className="flex h-full items-center gap-2 px-4 lg:gap-3 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </Button>
        <form
          className="hidden min-w-0 flex-1 md:block md:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (pathname.startsWith("/notes")) {
              router.push(`/notes?q=${encodeURIComponent(query)}`);
              return;
            }
            router.push(`/transactions?q=${encodeURIComponent(query)}`);
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-9 rounded-md bg-card pl-8"
              aria-label="Search transactions"
            />
          </div>
        </form>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
            <Link href="/daily-check">
              <Bell className="size-4" />
            </Link>
          </Button>
          <Button className="rounded-md" onClick={() => openQuickAdd("expense")}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Quick add</span>
          </Button>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="hidden size-8 items-center justify-center rounded-full border border-border bg-card text-[11px] font-medium sm:flex"
            aria-label="Profile"
          >
            {initials}
          </button>
        </div>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
