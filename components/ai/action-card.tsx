"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AIActionView } from "@/lib/ai/types";

export function ActionCard({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  action: AIActionView;
  busy?: boolean;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  const pending = action.status === "pending";
  const executed = action.status === "executed";
  const cancelled = action.status === "cancelled";
  const failed = action.status === "failed";

  return (
    <div className="max-w-sm rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold">{action.title}</p>
      <div className="mt-3 space-y-1.5">
        {action.fields.map((field) => (
          <div key={`${field.label}-${field.value}`} className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground">{field.label}</p>
            <p className="text-sm font-medium tabular-nums">{field.value}</p>
          </div>
        ))}
      </div>
      {executed && action.resultSummary ? (
        <p className="mt-3 text-sm text-income">{action.resultSummary}</p>
      ) : null}
      {failed && action.resultSummary ? (
        <p className="mt-3 text-sm text-destructive">{action.resultSummary}</p>
      ) : null}
      {cancelled ? <p className="mt-3 text-sm text-muted-foreground">Cancelled</p> : null}
      {pending && onConfirm && onCancel ? (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(action.id)}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onConfirm(action.id)}>
            Confirm
          </Button>
        </div>
      ) : null}
      {executed && action.href ? (
        <Button variant="link" size="sm" className="mt-2 h-auto px-0" asChild>
          <Link href={action.href}>View</Link>
        </Button>
      ) : null}
    </div>
  );
}
