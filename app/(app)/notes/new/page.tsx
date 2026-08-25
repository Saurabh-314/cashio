import type { Metadata } from "next";
import { Suspense } from "react";
import { NoteEditorView } from "@/components/notes/note-editor";

export const metadata: Metadata = { title: "New note" };

export default function NewNotePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Opening editor…</p>}>
      <NoteEditorView />
    </Suspense>
  );
}
