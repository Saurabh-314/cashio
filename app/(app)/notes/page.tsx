import type { Metadata } from "next";
import { Suspense } from "react";
import { NotesView } from "@/components/notes/notes-view";
import { TableSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <NotesView />
    </Suspense>
  );
}
