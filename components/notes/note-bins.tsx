"use client";

import Link from "next/link";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFinance } from "@/hooks/use-finance";
import { formatNoteDate, previewText } from "@/lib/notes";
import { getErrorMessage } from "@/lib/firebase/errors";
import type { Note } from "@/types";

export function NoteArchiveView() {
  const { notes, noteCategories, restoreNote, trashNote } = useFinance();
  const archived = notes.filter((item) => item.isArchived && !item.isDeleted);

  return (
    <NoteBin
      title="Archive"
      description="Archived notes stay out of the main list until you restore them."
      emptyTitle="Nothing archived"
      emptyDescription="Archive a note when you no longer need it day to day."
      icon={Archive}
      notes={archived}
      categories={noteCategories}
      primaryLabel="Restore"
      onPrimary={async (note) => {
        try {
          await restoreNote(note.id);
          toast.success("Restored");
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }}
      secondaryLabel="Delete"
      onSecondary={async (note) => {
        try {
          await trashNote(note.id);
          toast.success("Moved to trash");
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }}
    />
  );
}

export function NoteTrashView() {
  const { notes, noteCategories, restoreTrashedNote, deleteNoteForever } = useFinance();
  const trashed = notes.filter((item) => item.isDeleted);

  return (
    <NoteBin
      title="Trash"
      description="Deleted notes stay here for a while so you can restore them if needed."
      emptyTitle="Trash is empty"
      emptyDescription="Deleted notes appear here before they are removed permanently."
      icon={Trash2}
      notes={trashed}
      categories={noteCategories}
      primaryLabel="Restore"
      onPrimary={async (note) => {
        try {
          await restoreTrashedNote(note.id);
          toast.success("Restored");
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }}
      secondaryLabel="Delete permanently"
      onSecondary={async (note) => {
        try {
          await deleteNoteForever(note.id);
          toast.success("Deleted");
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }}
    />
  );
}

function NoteBin({
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon: Icon,
  notes,
  categories,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: typeof Archive;
  notes: Note[];
  categories: { id: string; name: string }[];
  primaryLabel: string;
  onPrimary: (note: Note) => Promise<void>;
  secondaryLabel: string;
  onSecondary: (note: Note) => Promise<void>;
}) {
  return (
    <div>
      <PageHeader title={title} description={description}>
        <Button variant="outline" asChild>
          <Link href="/notes">Back to notes</Link>
        </Button>
      </PageHeader>
      {notes.length ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="rounded-lg">
              <CardContent className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/notes/${note.id}`} className="min-w-0 flex-1">
                  <p className="font-medium">{note.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{previewText(note.content)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {categories.find((item) => item.id === note.categoryId)?.name ?? "Uncategorised"} ·{" "}
                    {formatNoteDate(note.updatedAt, "d MMM yyyy")}
                  </p>
                </Link>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onPrimary(note)}>
                    <RotateCcw /> {primaryLabel}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onSecondary(note)}>
                    {secondaryLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}
