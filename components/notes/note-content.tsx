"use client";

import { Fragment, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+]\(https?:\/\/[^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push(<Fragment key={`${keyPrefix}-t-${index}`}>{text.slice(last, match.index)}</Fragment>);
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-i-${index}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-c-${index}`} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = token.match(/^\[([^\]]+)]\((https?:\/\/[^)]+)\)$/);
      if (link) {
        nodes.push(
          <a
            key={`${keyPrefix}-a-${index}`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={`${keyPrefix}-f-${index}`}>{token}</Fragment>);
      }
    }
    last = match.index + token.length;
    index += 1;
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-end`}>{text.slice(last)}</Fragment>);
  }
  return nodes;
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
  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">No content yet.</p>;
  }

  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;
  let checklistIndex = -1;

  function flushList() {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
        className={cn("my-3 space-y-1 pl-5 text-sm leading-relaxed", list.ordered ? "list-decimal" : "list-disc")}
      >
        {list.items}
      </Tag>,
    );
    list = null;
  }

  lines.forEach((line, lineIndex) => {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const checklist = line.match(/^(\s*)[-*] \[([ xX])\] (.*)$/);
    const bullet = line.match(/^(\s*)[-*] (.*)$/);
    const ordered = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (heading) {
      flushList();
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      const size = heading[1].length === 1 ? "font-display text-2xl" : heading[1].length === 2 ? "font-display text-xl" : "text-base font-semibold";
      blocks.push(
        <Tag key={lineIndex} className={cn("mt-6 mb-2 font-medium tracking-tight", size)}>
          {renderInline(heading[2], `h-${lineIndex}`)}
        </Tag>,
      );
      return;
    }

    if (checklist) {
      flushList();
      checklistIndex += 1;
      const itemIndex = checklistIndex;
      const checked = checklist[2].toLowerCase() === "x";
      blocks.push(
        <label key={lineIndex} className="flex items-start gap-2.5 py-1 text-sm leading-relaxed">
          <Checkbox
            checked={checked}
            disabled={!onToggleItem}
            onCheckedChange={() => onToggleItem?.(itemIndex)}
            className="mt-0.5"
          />
          <span className={cn(checked && "text-muted-foreground line-through")}>
            {renderInline(checklist[3], `c-${lineIndex}`)}
          </span>
        </label>,
      );
      return;
    }

    if (bullet || ordered) {
      const orderedList = Boolean(ordered);
      if (!list || list.ordered !== orderedList) {
        flushList();
        list = { ordered: orderedList, items: [] };
      }
      list.items.push(
        <li key={lineIndex}>{renderInline((bullet ?? ordered)?.[2] ?? "", `l-${lineIndex}`)}</li>,
      );
      return;
    }

    flushList();
    if (!line.trim()) {
      blocks.push(<div key={lineIndex} className="h-2" />);
      return;
    }
    blocks.push(
      <p key={lineIndex} className="text-sm leading-relaxed">
        {renderInline(line, `p-${lineIndex}`)}
      </p>,
    );
  });
  flushList();

  return <div className={cn("max-w-2xl", className)}>{blocks}</div>;
}
