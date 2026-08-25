import type { Metadata } from "next";
import { NoteDetailView } from "@/components/notes/note-detail-view";

export const metadata: Metadata = { title: "Note" };

export default async function NoteDetailPage({
  params,
}: PageProps<"/notes/[noteId]">) {
  const { noteId } = await params;
  return <NoteDetailView noteId={noteId} />;
}
