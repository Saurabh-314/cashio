"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { NoteEditorToolbar } from "@/components/notes/note-editor-toolbar";
import { parseNoteContent } from "@/lib/note-document";
import { cn } from "@/lib/utils";

export interface NoteEditorCanvasProps {
  initialContent?: JSONContent | string;
  onChange?: (content: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}

export function NoteEditorCanvas({
  initialContent,
  onChange,
  editable = true,
  placeholder = "Start writing your note...",
  className,
}: NoteEditorCanvasProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        code: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: false,
        a11y: {
          checkboxLabel: (node, checked) =>
            `${checked ? "Completed" : "Incomplete"} task: ${node.textContent || "empty"}`,
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: typeof initialContent === "string" ? parseNoteContent(initialContent) : (initialContent ?? parseNoteContent("")),
    editorProps: {
      attributes: {
        class: "cashio-note-editor-content",
      },
      transformPastedHTML(html) {
        return html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/\s(?:style|class|color|face|size|bgcolor|font)=("[^"]*"|'[^']*')/gi, "")
          .replace(/\s+on\w+=("[^"]*"|'[^']*')/gi, "");
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange?.(current.getJSON());
    },
  });

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      {editable ? <NoteEditorToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
