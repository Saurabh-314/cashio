"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AiEntryCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="font-display text-lg font-medium">Cashio AI</p>
            <p className="mt-1 text-sm text-muted-foreground">Ask anything about your money</p>
            <p className="mt-2 text-sm text-muted-foreground">“Where did I spend the most?”</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/ai">Ask Cashio AI →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AiInsightCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Cashio AI Insight</p>
        <p className="mt-2 text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <Button variant="link" className="mt-2 h-auto px-0" asChild>
          <Link href="/ai">View analysis →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
