"use client";

import { useState } from "react";
import { Download, FileText, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { NoteAttachment } from "@/types";

function isImage(type: string) {
  return type.startsWith("image/");
}

export function NoteAttachments({
  attachments,
  onRemove,
}: {
  attachments: NoteAttachment[];
  onRemove?: (id: string) => void;
}) {
  const [preview, setPreview] = useState<NoteAttachment | null>(null);
  if (!attachments.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Attachments</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((file) => (
          <div key={file.id} className="overflow-hidden rounded-lg border border-border bg-card">
            {isImage(file.type) ? (
              <button type="button" className="block w-full" onClick={() => setPreview(file)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt={file.name} className="h-36 w-full object-cover" />
              </button>
            ) : (
              <div className="flex h-20 items-center gap-3 px-4">
                <FileText className="size-4 text-muted-foreground" />
                <p className="truncate text-sm">{file.name}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">{file.name}</p>
              <div className="flex gap-1">
                <Button size="icon-xs" variant="ghost" asChild>
                  <a href={file.url} download={file.name} target="_blank" rel="noreferrer" aria-label="Download">
                    <Download />
                  </a>
                </Button>
                {onRemove ? (
                  <Button size="icon-xs" variant="ghost" onClick={() => onRemove(file.id)} aria-label="Remove">
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{preview?.name}</DialogTitle>
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.name} className="max-h-[85vh] w-full rounded-lg object-contain" />
              <Button
                size="icon-sm"
                variant="secondary"
                className="absolute top-3 right-3"
                onClick={() => setPreview(null)}
              >
                <X />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
