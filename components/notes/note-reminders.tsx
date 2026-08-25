"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { visibleReminders } from "@/lib/notes";

function seenKey(uid: string) {
  return `cashio.noteReminders.${uid}`;
}

function loadSeen(uid: string): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(seenKey(uid)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveSeen(uid: string, ids: string[]) {
  window.localStorage.setItem(seenKey(uid), JSON.stringify(ids.slice(-80)));
}

export function NoteReminders() {
  const { user, profile } = useAuth();
  const { notes } = useFinance();
  const [askPermission, setAskPermission] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!user?.uid || shown.current) return;
    const due = visibleReminders(notes);
    if (!due.length) return;
    shown.current = true;
    const seen = new Set(loadSeen(user.uid));
    const fresh = due.filter((note) => !seen.has(`${note.id}:${note.reminderAt}`));
    if (!fresh.length) return;

    for (const note of fresh.slice(0, 4)) {
      toast(`${note.title} reminder`, { description: "Open Notes to review this reminder." });
      if (profile?.notifications?.notes !== false && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`${note.title} reminder`, { body: "A note reminder is due." });
      }
      seen.add(`${note.id}:${note.reminderAt}`);
    }
    saveSeen(user.uid, [...seen]);

    if (
      profile?.notifications?.notes !== false &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time permission prompt
      setAskPermission(true);
    }
  }, [notes, profile?.notifications?.notes, user?.uid]);

  if (!askPermission) return null;

  return (
    <div className="fixed bottom-24 left-4 z-40 max-w-xs rounded-lg border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)] md:bottom-6 md:left-[17rem]">
      <p className="font-medium">Browser notifications</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Cashio can also show note reminders in the browser. Permission is optional.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await Notification.requestPermission();
            setAskPermission(false);
          }}
        >
          Allow
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAskPermission(false)}>
          Not now
        </Button>
      </div>
    </div>
  );
}
