import { describe, expect, it } from "vitest";
import { markdownToNoteDocument, serializeNoteContent } from "@/lib/note-document";
import { noteMatchesQuery, previewText } from "@/lib/notes";
import type { Note } from "@/types";

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "Monthly Expenses",
    content: "",
    tags: [],
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    attachments: [],
    timeline: [],
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("note list helpers", () => {
  it("shows a readable preview instead of raw JSON", () => {
    const content = serializeNoteContent(markdownToNoteDocument("Things I need to pay this month"));
    expect(previewText(content)).toBe("Things I need to pay this month");
    expect(previewText(content)).not.toContain('"type"');
    expect(previewText(content)).not.toContain("<p>");
  });

  it("searches title and readable body, not serialized JSON keys", () => {
    const item = note({
      content: serializeNoteContent(markdownToNoteDocument("Pay the electricity bill")),
    });
    expect(noteMatchesQuery(item, "electricity")).toBe(true);
    expect(noteMatchesQuery(item, "monthly")).toBe(true);
    expect(noteMatchesQuery(item, '"type":"doc"')).toBe(false);
  });
});
