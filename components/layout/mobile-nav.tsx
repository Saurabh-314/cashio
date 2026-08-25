"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { MOBILE_NAV } from "@/constants/navigation";
import { useFinance } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { openQuickAdd } = useFinance();

  return (
    <>
      <button
        type="button"
        onClick={() => openQuickAdd("expense")}
        className="fixed right-4 bottom-20 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-hover)] transition-colors duration-200 hover:bg-primary/90 md:hidden"
        aria-label="Add transaction"
      >
        <Plus className="size-5" />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-4">
          {MOBILE_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] tracking-wide uppercase",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-4" strokeWidth={1.6} />
                  {item.href === "/daily-check" ? "Check" : item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
