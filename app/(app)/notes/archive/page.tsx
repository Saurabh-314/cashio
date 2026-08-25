import type { Metadata } from "next";
import { NoteArchiveView } from "@/components/notes/note-bins";

export const metadata: Metadata = { title: "Archive" };

export default function NotesArchivePage() {
  return <NoteArchiveView />;
}
