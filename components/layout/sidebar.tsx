"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { EXTRA_NAV, PRIMARY_NAV } from "@/constants/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile, logout } = useAuth();

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          ₹
        </div>
        <div>
          <p className="font-display text-lg leading-none font-medium">Cashio</p>
          <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">Private ledger</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {PRIMARY_NAV.filter((item) => item.href !== "/settings").map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-200",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
        <div className="pt-4 pb-1 pl-3 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">More</div>
        {EXTRA_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-200",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-sidebar-border px-3 py-4">
        <p className="truncate px-3 text-sm font-medium">{profile?.displayName ?? "Account"}</p>
        <p className="truncate px-3 text-xs text-muted-foreground">{profile?.email}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground" onClick={() => logout()}>
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
}
