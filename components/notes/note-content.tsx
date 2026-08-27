"use client";

import type { JSONContent } from "@tiptap/react";
import { Checkbox } from "@/components/ui/checkbox";
import { parseNoteContent, notePlainText } from "@/lib/note-document";
import { cn } from "@/lib/utils";

function InlineText({ node }: { node: JSONContent }) {
  const marks = new Set((node.marks ?? []).map((mark) => mark.type));
  let content = <>{node.text}</>;
  if (marks.has("italic")) content = <em>{content}</em>;
  if (marks.has("bold")) content = <strong className="font-semibold">{content}</strong>;
  return content;
}

function childrenOf(node: JSONContent, onToggleItem?: (index: number) => void) {
  return (node.content ?? []).map((child, index) => (
    <NodeView key={`${child.type}-${index}`} node={child} onToggleItem={onToggleItem} />
  ));
}

function NodeView({
  node,
  onToggleItem,
}: {
  node: JSONContent;
  onToggleItem?: (index: number) => void;
}) {
  if (node.type === "text") return <InlineText node={node} />;
  if (node.type === "hardBreak") return <br />;

  if (node.type === "paragraph") {
    return <p className="text-sm leading-relaxed">{node.content?.length ? childrenOf(node, onToggleItem) : <br />}</p>;
  }

  if (node.type === "bulletList") {
    return <ul className="my-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">{childrenOf(node, onToggleItem)}</ul>;
  }

  if (node.type === "orderedList") {
    return <ol className="my-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">{childrenOf(node, onToggleItem)}</ol>;
  }

  if (node.type === "listItem") {
    return <li>{childrenOf(node, onToggleItem)}</li>;
  }

  if (node.type === "taskList") {
    return <ul className="my-3 space-y-1 text-sm leading-relaxed">{childrenOf(node, onToggleItem)}</ul>;
  }

  if (node.type === "taskItem") {
    const index = Number(node.attrs?.checklistIndex ?? 0);
    const checked = Boolean(node.attrs?.checked);
    return (
      <li className="flex items-start gap-2.5 py-0.5">
        <Checkbox
          checked={checked}
          disabled={!onToggleItem}
          onCheckedChange={() => onToggleItem?.(index)}
          className="mt-0.5"
          aria-label={checked ? "Completed checklist item" : "Checklist item"}
        />
        <div className={cn("min-w-0 flex-1 [&_p]:my-0", checked && "text-muted-foreground line-through")}>
          {childrenOf(node, onToggleItem)}
        </div>
      </li>
    );
  }

  if (node.type === "heading") {
    return <p className="text-sm font-medium leading-relaxed">{childrenOf(node, onToggleItem)}</p>;
  }

  if (node.type === "doc") {
    return <>{childrenOf(node, onToggleItem)}</>;
  }

  return <>{childrenOf(node, onToggleItem)}</>;
}

function withChecklistIndices(node: JSONContent, counter = { index: 0 }): JSONContent {
  if (node.type === "taskItem") {
    const nextIndex = counter.index;
    counter.index += 1;
    return {
      ...node,
      attrs: { ...node.attrs, checklistIndex: nextIndex },
      content: node.content?.map((child) => withChecklistIndices(child, counter)),
    };
  }
  if (!node.content) return node;
  return { ...node, content: node.content.map((child) => withChecklistIndices(child, counter)) };
}

export function NoteContent({
  content,
  onToggleItem,
  className,
}: {
  content: string;
  onToggleItem?: (index: number) => void;
  className?: string;
}) {
  const doc = withChecklistIndices(parseNoteContent(content));

  if (!notePlainText(content)) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  return (
    <div className={cn("max-w-2xl space-y-3", className)}>
      <NodeView node={doc} onToggleItem={onToggleItem} />
    </div>
  );
}
