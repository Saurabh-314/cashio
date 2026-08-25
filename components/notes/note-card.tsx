"use client";

import Link from "next/link";
import { Pin } from "lucide-react";
import { formatNoteDate, hasChecklist, checklistProgress, previewText } from "@/lib/notes";
import { cn } from "@/lib/utils";
import type { Note, NoteCategory } from "@/types";

export function NoteCard({
  note,
  category,
}: {
  note: Note;
  category?: NoteCategory;
}) {
  const checklist = checklistProgress(note.content);
  const preview = previewText(note.content);

  return (
    <Link
      href={`/notes/${note.id}`}
      className={cn(
        "group block rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-muted/40",
        note.isPinned && "border-border bg-accent/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium tracking-tight text-foreground">{note.title || "Untitled"}</h3>
        {note.isPinned ? <Pin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
      </div>
      {preview ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{preview}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Empty note</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {category ? <span>{category.name}</span> : null}
        {hasChecklist(note.content) ? (
          <span>
            {checklist.done} / {checklist.total} completed
          </span>
        ) : null}
        {note.reminderAt ? <span>Reminder {formatNoteDate(note.reminderAt, "d MMM yyyy")}</span> : null}
        <span>Updated {formatNoteDate(note.updatedAt, "d MMM")}</span>
      </div>
    </Link>
  );
}
