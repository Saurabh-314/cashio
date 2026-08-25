import type { Metadata } from "next";
import { NoteTrashView } from "@/components/notes/note-bins";

export const metadata: Metadata = { title: "Trash" };

export default function NotesTrashPage() {
  return <NoteTrashView />;
}
