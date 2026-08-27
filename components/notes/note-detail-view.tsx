"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isValid, parseISO } from "date-fns";
import { ArrowLeft, Archive, Pencil, Pin, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NoteContent } from "@/components/notes/note-content";
import { NoteAttachments } from "@/components/notes/note-attachments";
import { NoteEditorView } from "@/components/notes/note-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { checklistProgress, hasChecklist, relatedEntityHref, relatedEntityLabel, toggleChecklistItem } from "@/lib/notes";
import { formatDate } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/firebase/errors";

export function NoteDetailView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    notes,
    noteCategories,
    accounts,
    activities,
    providers,
    transactions,
    bills,
    goals,
    loans,
    saveNote,
    pinNote,
    archiveNote,
    trashNote,
    restoreNote,
    restoreTrashedNote,
    deleteNoteForever,
    removeNoteFile,
  } = useFinance();
  const note = notes.find((item) => item.id === noteId);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const category = noteCategories.find((item) => item.id === note?.categoryId);
  const progress = note ? checklistProgress(note.content) : { total: 0, done: 0 };

  if (!note) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">This note was not found.</p>
        <Button asChild variant="outline">
          <Link href="/notes">Back to notes</Link>
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel editing
        </Button>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Opening editor…</p>}>
          <NoteEditorView noteId={note.id} />
        </Suspense>
      </div>
    );
  }

  const current = note;

  async function toggleItem(index: number) {
    try {
      await saveNote(
        {
          title: current.title,
          content: toggleChecklistItem(current.content, index),
          categoryId: current.categoryId,
          tags: current.tags,
          isPinned: current.isPinned,
          isArchived: current.isArchived,
          reminderAt: current.reminderAt,
          relatedEntity: current.relatedEntity,
          attachments: current.attachments,
          timeline: current.timeline,
        },
        current.id,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  const related = note.relatedEntity
    ? relatedEntityLabel(note.relatedEntity.type, note.relatedEntity.id, {
        accounts,
        activities,
        providers,
        transactions,
        bills,
        goals,
        loans,
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/notes">
            <ArrowLeft /> Notes
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => pinNote(note.id, !note.isPinned)}>
            <Pin /> {note.isPinned ? "Unpin" : "Pin"}
          </Button>
          {note.isDeleted ? (
            <>
              <Button variant="outline" size="sm" onClick={() => restoreTrashedNote(note.id)}>
                <RotateCcw /> Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Delete permanently
              </Button>
            </>
          ) : note.isArchived ? (
            <>
              <Button variant="outline" size="sm" onClick={() => restoreNote(note.id)}>
                <RotateCcw /> Restore
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTrashOpen(true)}>
                <Trash2 /> Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => archiveNote(note.id)}>
                <Archive /> Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTrashOpen(true)}>
                <Trash2 /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{category?.name ?? "Uncategorised"}</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">{note.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Created {formatDate(note.createdAt.slice(0, 10), profile?.dateFormat)} · Updated{" "}
          {formatDate(note.updatedAt.slice(0, 10), profile?.dateFormat)}
        </p>
      </div>

      {note.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {note.reminderAt ? (
        <p className="text-sm">
          Reminder {formatDate(note.reminderAt, profile?.dateFormat)}
        </p>
      ) : null}

      {hasChecklist(note.content) ? (
        <p className="text-sm text-muted-foreground">
          {progress.done} / {progress.total} completed
        </p>
      ) : null}

      <NoteContent content={note.content} onToggleItem={toggleItem} />

      <NoteAttachments attachments={note.attachments} onRemove={(id) => removeNoteFile(note.id, id)} />

      {related && note.relatedEntity ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Related</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href={relatedEntityHref(note.relatedEntity.type, note.relatedEntity.id)}>{related}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {note.relatedEntity && note.timeline.length ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {note.timeline
              .slice()
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((event) => {
                const at = parseISO(event.at);
                return (
                  <div key={event.id} className="flex gap-4 text-sm">
                    <span className="w-20 shrink-0 text-muted-foreground">
                      {isValid(at) ? format(at, "d MMM") : ""}
                    </span>
                    <span>{event.label}</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        title="Delete this note?"
        description="The note will be moved to trash. You can restore it later."
        confirmLabel="Delete"
        onConfirm={() => {
          void trashNote(note.id);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this note?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteNoteForever(note.id);
          router.replace("/notes/trash");
        }}
      />
    </div>
  );
}
