import { describe, expect, it } from "vitest";
import {
  convertNoteChecklistToList,
  markdownToNoteDocument,
  noteChecklistProgress,
  notePlainText,
  parseNoteContent,
  serializeNoteContent,
  toggleNoteChecklistItem,
} from "@/lib/note-document";

describe("note documents", () => {
  it("parses stored Tiptap JSON", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }] }] }],
    };
    expect(parseNoteContent(JSON.stringify(doc))).toEqual(doc);
  });

  it("converts markdown bold, italic, lists and checklists", () => {
    const doc = markdownToNoteDocument("Pay **electricity** and *rent*\n\n- Milk\n- Bread\n\n- [ ] Call Rahul\n- [x] Done");
    expect(notePlainText(serializeNoteContent(doc))).toContain("Pay electricity and rent");
    expect(noteChecklistProgress(serializeNoteContent(doc))).toEqual({ total: 2, done: 1 });
  });

  it("toggles checklist state and keeps other formatting", () => {
    const raw = serializeNoteContent(
      markdownToNoteDocument("- [ ] Buy milk\n- [x] Pay bill"),
    );
    const toggled = toggleNoteChecklistItem(raw, 0);
    expect(noteChecklistProgress(toggled)).toEqual({ total: 2, done: 2 });
    const again = toggleNoteChecklistItem(toggled, 1);
    expect(noteChecklistProgress(again)).toEqual({ total: 2, done: 1 });
  });

  it("converts checklists to bullet lists", () => {
    const raw = serializeNoteContent(markdownToNoteDocument("- [x] Complete project"));
    const next = JSON.parse(convertNoteChecklistToList(raw)) as { content: { type: string }[] };
    expect(next.content[0]?.type).toBe("bulletList");
  });

  it("extracts readable preview text instead of JSON", () => {
    const raw = serializeNoteContent(
      markdownToNoteDocument("Things I need to pay this month"),
    );
    expect(notePlainText(raw)).toBe("Things I need to pay this month");
    expect(notePlainText(raw)).not.toContain('"type":"doc"');
  });

  it("keeps bold and italic independent", () => {
    const doc = markdownToNoteDocument("***both*** and **bold** and *italic*");
    const json = JSON.stringify(doc);
    expect(json).toContain('"type":"bold"');
    expect(json).toContain('"type":"italic"');
    expect(notePlainText(serializeNoteContent(doc))).toBe("both and bold and italic");
  });

  it("parses bullet and numbered lists", () => {
    const doc = markdownToNoteDocument("- Milk\n- Bread\n\n1. Buy groceries\n2. Pay electricity bill");
    expect(doc.content?.[0]?.type).toBe("bulletList");
    expect(doc.content?.[1]?.type).toBe("orderedList");
    expect(notePlainText(serializeNoteContent(doc))).toContain("Milk");
    expect(notePlainText(serializeNoteContent(doc))).toContain("Pay electricity bill");
  });

  it("adds, checks, unchecks and deletes checklist items in stored JSON", () => {
    const created = serializeNoteContent(markdownToNoteDocument("- [ ] Buy milk\n- [ ] Pay bill"));
    expect(noteChecklistProgress(created)).toEqual({ total: 2, done: 0 });

    const checked = toggleNoteChecklistItem(created, 0);
    expect(noteChecklistProgress(checked)).toEqual({ total: 2, done: 1 });

    const unchecked = toggleNoteChecklistItem(checked, 0);
    expect(noteChecklistProgress(unchecked)).toEqual({ total: 2, done: 0 });

    const remaining = mapWithoutFirstTask(unchecked);
    expect(noteChecklistProgress(remaining)).toEqual({ total: 1, done: 0 });
    expect(notePlainText(remaining)).toBe("Pay bill");
  });

  it("round-trips JSON without losing checklist checks", () => {
    const original = serializeNoteContent(markdownToNoteDocument("- [x] Complete Cashio AI\n- [ ] Test Notes"));
    const again = serializeNoteContent(parseNoteContent(original));
    expect(noteChecklistProgress(again)).toEqual({ total: 2, done: 1 });
  });
});

function mapWithoutFirstTask(raw: string): string {
  const doc = parseNoteContent(raw);
  const list = doc.content?.[0];
  if (!list?.content) return raw;
  return serializeNoteContent({
    ...doc,
    content: [{ ...list, content: list.content.slice(1) }],
  });
}
