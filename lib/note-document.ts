import type { JSONContent } from "@tiptap/core";

export const EMPTY_NOTE_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function isNoteDocument(value: unknown): value is JSONContent {
  return Boolean(value && typeof value === "object" && (value as JSONContent).type === "doc");
}

export function parseNoteContent(raw: string): JSONContent {
  const trimmed = raw.trim();
  if (!trimmed) return EMPTY_NOTE_DOC;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isNoteDocument(parsed)) return parsed;
    } catch {
      // Legacy markdown / plain text.
    }
  }
  return markdownToNoteDocument(raw);
}

export function serializeNoteContent(doc: JSONContent): string {
  return JSON.stringify(doc);
}

export function notePlainText(raw: string): string {
  return collectText(parseNoteContent(raw)).replace(/\s+/g, " ").trim();
}

export function noteChecklistProgress(raw: string): { total: number; done: number } {
  let total = 0;
  let done = 0;
  walk(parseNoteContent(raw), (node) => {
    if (node.type !== "taskItem") return;
    total += 1;
    if (node.attrs?.checked) done += 1;
  });
  return { total, done };
}

export function toggleNoteChecklistItem(raw: string, index: number): string {
  let current = -1;
  const next = mapNodes(parseNoteContent(raw), (node) => {
    if (node.type !== "taskItem") return node;
    current += 1;
    if (current !== index) return node;
    return {
      ...node,
      attrs: { ...node.attrs, checked: !node.attrs?.checked },
    };
  });
  return serializeNoteContent(next);
}

export function convertNoteChecklistToList(raw: string): string {
  const next = mapNodes(parseNoteContent(raw), (node) => {
    if (node.type === "taskList") return { ...node, type: "bulletList" };
    if (node.type === "taskItem") return { ...node, type: "listItem", attrs: undefined };
    return node;
  });
  return serializeNoteContent(next);
}

function walk(node: JSONContent, visit: (node: JSONContent) => void) {
  visit(node);
  node.content?.forEach((child) => walk(child, visit));
}

function mapNodes(node: JSONContent, mapper: (node: JSONContent) => JSONContent): JSONContent {
  const mapped = mapper(node);
  if (!mapped.content) return mapped;
  return { ...mapped, content: mapped.content.map((child) => mapNodes(child, mapper)) };
}

function collectText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  const parts = (node.content ?? []).map(collectText);
  if (node.type === "paragraph" || node.type === "listItem" || node.type === "taskItem" || node.type === "hardBreak") {
    return `${parts.join("")}\n`;
  }
  return parts.join("");
}

function inlineNodes(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push({ type: "text", text: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("***") && token.endsWith("***")) {
      nodes.push({
        type: "text",
        text: token.slice(3, -3),
        marks: [{ type: "bold" }, { type: "italic" }],
      });
    } else if (token.startsWith("**")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "bold" }] });
    } else {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.filter((node) => node.text);
}

function paragraph(text: string): JSONContent {
  const content = inlineNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function listItem(text: string): JSONContent {
  return { type: "listItem", content: [paragraph(text)] };
}

function taskItem(text: string, checked: boolean): JSONContent {
  return { type: "taskItem", attrs: { checked }, content: [paragraph(text)] };
}

export function markdownToNoteDocument(raw: string): JSONContent {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let buffer: { kind: "bullet" | "ordered" | "task"; items: JSONContent[] } | null = null;

  function flush() {
    if (!buffer) return;
    const type = buffer.kind === "task" ? "taskList" : buffer.kind === "ordered" ? "orderedList" : "bulletList";
    content.push({ type, content: buffer.items });
    buffer = null;
  }

  for (const line of lines) {
    const task = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);

    if (task) {
      if (buffer?.kind !== "task") flush();
      buffer ??= { kind: "task", items: [] };
      buffer.items.push(taskItem(task[2], task[1].toLowerCase() === "x"));
      continue;
    }
    if (bullet) {
      if (buffer?.kind !== "bullet") flush();
      buffer ??= { kind: "bullet", items: [] };
      buffer.items.push(listItem(bullet[1]));
      continue;
    }
    if (ordered) {
      if (buffer?.kind !== "ordered") flush();
      buffer ??= { kind: "ordered", items: [] };
      buffer.items.push(listItem(ordered[1]));
      continue;
    }

    flush();
    if (!line.trim()) {
      continue;
    }
    content.push(paragraph(heading ? heading[1] : line));
  }
  flush();
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function renderInline(node: JSONContent): string {
  const text = node.text ?? "";
  const marks = new Set((node.marks ?? []).map((mark) => mark.type));
  if (marks.has("bold") && marks.has("italic")) return `***${text}***`;
  if (marks.has("bold")) return `**${text}**`;
  if (marks.has("italic")) return `*${text}*`;
  return text;
}

function renderBlock(node: JSONContent): string {
  if (node.type === "text") return renderInline(node);
  if (node.type === "hardBreak") return "\n";
  if (node.type === "paragraph") return (node.content ?? []).map(renderBlock).join("");
  if (node.type === "listItem" || node.type === "taskItem") {
    return (node.content ?? []).map(renderBlock).join("\n");
  }
  if (node.type === "bulletList") {
    return (node.content ?? []).map((item) => `- ${renderBlock(item)}`).join("\n");
  }
  if (node.type === "orderedList") {
    return (node.content ?? [])
      .map((item, index) => `${index + 1}. ${renderBlock(item)}`)
      .join("\n");
  }
  if (node.type === "taskList") {
    return (node.content ?? [])
      .map((item) => `- [${item.attrs?.checked ? "x" : " "}] ${renderBlock(item)}`)
      .join("\n");
  }
  if (node.type === "doc") {
    return (node.content ?? []).map(renderBlock).join("\n\n");
  }
  return (node.content ?? []).map(renderBlock).join("");
}

export function noteDocumentToMarkdown(doc: JSONContent): string {
  return renderBlock(doc).trim();
}
