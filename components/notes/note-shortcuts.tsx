"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFinance } from "@/hooks/use-finance";
import { isTypingTarget } from "@/lib/notes";

export function NoteShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { openQuickAdd } = useFinance();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        openQuickAdd("note");
      }
      if (key === "/") {
        event.preventDefault();
        if (pathname.startsWith("/notes") && pathname === "/notes") {
          window.dispatchEvent(new Event("cashio:focus-note-search"));
        } else {
          router.push("/notes");
          window.setTimeout(() => {
            window.dispatchEvent(new Event("cashio:focus-note-search"));
          }, 80);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openQuickAdd, pathname, router]);

  return null;
}
