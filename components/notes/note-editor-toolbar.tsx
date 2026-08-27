"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Bold, Italic, List, ListChecks, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TOOLS = [
  { action: "bold" as const, label: "Bold", shortcut: "⌘B", icon: Bold },
  { action: "italic" as const, label: "Italic", shortcut: "⌘I", icon: Italic },
  { action: "bullet" as const, label: "Bullet list", shortcut: "•", icon: List },
  { action: "ordered" as const, label: "Numbered list", shortcut: "1.", icon: ListOrdered },
  { action: "task" as const, label: "Checklist", shortcut: "☑", icon: ListChecks },
];

export function NoteEditorToolbar({ editor }: { editor: Editor | null }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      bullet: current?.isActive("bulletList") ?? false,
      ordered: current?.isActive("orderedList") ?? false,
      task: current?.isActive("taskList") ?? false,
    }),
  });

  function run(action: (typeof TOOLS)[number]["action"]) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (action === "bold") chain.toggleBold().run();
    if (action === "italic") chain.toggleItalic().run();
    if (action === "bullet") chain.toggleBulletList().run();
    if (action === "ordered") chain.toggleOrderedList().run();
    if (action === "task") chain.toggleTaskList().run();
  }

  return (
    <div className="sticky top-16 z-20 flex gap-1 overflow-x-auto rounded-t-lg border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur-md">
      {TOOLS.map((item) => {
        const pressed = Boolean(active?.[item.action]);
        return (
          <Tooltip key={item.action}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={pressed ? "secondary" : "ghost"}
                className={cn("size-10 shrink-0", pressed && "bg-muted text-foreground")}
                aria-label={item.label}
                aria-pressed={pressed}
                disabled={!editor}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(item.action)}
              >
                <item.icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {item.label}
              <span className="text-background/70">{item.shortcut}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
