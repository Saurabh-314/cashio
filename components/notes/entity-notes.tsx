"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useFinance } from "@/hooks/use-finance";
import { notesForEntity, newNoteHref, previewText } from "@/lib/notes";
import { RELATED_CATEGORY_NAME } from "@/constants/notes";
import type { NoteRelatedType } from "@/types";

export function EntityNotes({
  type,
  entityId,
  entityName,
  inlineNote,
  onSaveInline,
  compact = false,
  title = "Notes",
}: {
  type: NoteRelatedType;
  entityId: string;
  entityName: string;
  inlineNote?: string;
  onSaveInline?: (value: string) => Promise<void> | void;
  compact?: boolean;
  title?: string;
}) {
  const { notes } = useFinance();
  const related = notesForEntity(notes, type, entityId).filter((item) => !item.isArchived);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(inlineNote ?? "");
  const href = newNoteHref({
    relatedType: type,
    relatedId: entityId,
    title: entityName,
    category: RELATED_CATEGORY_NAME[type],
  });

  const body = (
    <div className="space-y-3">
      {onSaveInline ? (
        editing ? (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await onSaveInline(draft);
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm leading-relaxed">{inlineNote?.trim() || "No note yet."}</p>
            <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => setEditing(true)}>
              {inlineNote?.trim() ? "Edit" : "Add a note"}
            </Button>
          </div>
        )
      ) : inlineNote?.trim() ? (
        <p className="text-sm leading-relaxed">{inlineNote}</p>
      ) : null}

      {related.length ? (
        <div className="space-y-2">
          {related.slice(0, compact ? 2 : 6).map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="block rounded-md bg-muted/50 px-3 py-2">
              <p className="text-sm font-medium">{note.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{previewText(note.content, 100)}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <Button size="sm" variant="outline" asChild>
        <Link href={href}>
          <Plus className="size-3.5" /> Add note
        </Link>
      </Button>
    </div>
  );

  if (compact) {
    return <div className="space-y-2">{body}</div>;
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
