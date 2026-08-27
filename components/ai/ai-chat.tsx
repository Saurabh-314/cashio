"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ActionCard } from "@/components/ai/action-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AIActionView, AIChatResponse } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How much did I spend this month?",
  "Who owes me money?",
  "What bills are coming?",
  "Can I afford a ₹30,000 phone?",
  "Analyze my spending",
  "Help me save ₹10,000",
];

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AIActionView[];
}

function renderContent(content: string) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, index) => {
        const key = `${index}-${line.slice(0, 12)}`;
        if (line.startsWith("### ")) {
          return (
            <p key={key} className="pt-1 font-semibold">
              {line.slice(4)}
            </p>
          );
        }
        if (line.startsWith("## ") || line.startsWith("# ")) {
          return (
            <p key={key} className="pt-1 font-display text-base font-medium">
              {line.replace(/^#+ /, "")}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <p key={key} className="pl-3">
              • {line.slice(2)}
            </p>
          );
        }
        if (!line.trim()) return <div key={key} className="h-1.5" />;
        return (
          <p key={key} className="whitespace-pre-wrap">
            {line.replace(/\*\*(.*?)\*\*/g, "$1")}
          </p>
        );
      })}
    </div>
  );
}

export function AiChat() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    const userItem: ChatItem = { id: crypto.randomUUID(), role: "user", content: message };
    setMessages((current) => [...current, userItem]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = (await res.json()) as AIChatResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.success === false ? data.error : "Cashio AI is temporarily unavailable. Please try again.");
      }
      setConversationId(data.data.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.data.message,
          actions: data.data.actions,
        },
      ]);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Cashio AI is temporarily unavailable. Please try again.";
      toast.error(messageText);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: messageText,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function patchAction(id: string, next: AIActionView) {
    setMessages((current) =>
      current.map((item) => ({
        ...item,
        actions: item.actions?.map((action) => (action.id === id ? next : action)),
      })),
    );
  }

  async function confirmAction(actionId: string) {
    if (!conversationId) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/ai/actions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, conversationId }),
      });
      const data = (await res.json()) as { success: boolean; data?: { action: AIActionView }; error?: string };
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error ?? "Could not confirm that action.");
      }
      patchAction(actionId, data.data.action);
      toast.success(data.data.action.resultSummary ?? "Done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm that action.");
    } finally {
      setActionBusy(false);
    }
  }

  async function cancelAction(actionId: string) {
    if (!conversationId) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/ai/actions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, conversationId }),
      });
      const data = (await res.json()) as { success: boolean; data?: { action: AIActionView }; error?: string };
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.error ?? "Could not cancel that action.");
      }
      patchAction(actionId, data.data.action);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel that action.");
    } finally {
      setActionBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="-mx-4 flex min-h-0 flex-1 flex-col lg:mx-0">
      <div className="shrink-0 px-4 py-4 lg:px-0">
        <h1 className="font-display text-[1.65rem] leading-tight font-medium tracking-tight lg:text-[2rem]">Cashio AI</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Your personal financial assistant</p>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 lg:px-0">
        {empty ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <Sparkles className="mb-4 size-5 text-muted-foreground" />
            <h3 className="font-display text-xl font-medium tracking-tight">Ask about your money</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Cashio AI uses your accounts, spending, people, and Daily Check data. It will confirm before changing anything.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((item) => (
              <div key={item.id} className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[min(100%,36rem)] rounded-lg px-4 py-3",
                    item.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground shadow-[var(--shadow-card)]",
                  )}
                >
                  {item.role === "assistant" ? renderContent(item.content) : <p className="text-sm whitespace-pre-wrap">{item.content}</p>}
                  {item.actions?.length ? (
                    <div className="mt-3 space-y-3">
                      {item.actions.map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          busy={actionBusy}
                          onConfirm={confirmAction}
                          onCancel={cancelAction}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex justify-start">
                <div className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
                  Thinking...
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-3 lg:px-0">
        {empty ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void send(item)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Cashio AI..."
            className="min-h-11 max-h-32 resize-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="submit" disabled={busy || !input.trim()} className="h-11">
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
