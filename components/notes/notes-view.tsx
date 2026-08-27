"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Bell, BookOpen, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NoteCard } from "@/components/notes/note-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinance } from "@/hooks/use-finance";
import { useIsMobile } from "@/hooks/use-media-query";
import { filterNotes, formatNoteDate, noteStats, sortNotes, visibleReminders } from "@/lib/notes";
import { NOTE_SORT_OPTIONS } from "@/constants/notes";
import type { NoteDateFilter, NoteSort, NoteStatusFilter } from "@/types";

const ALL = "__all__";

export function NotesView() {
  const { notes, noteCategories, loading } = useFinance();
  const router = useRouter();
  const mobile = useIsMobile();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<NoteStatusFilter>("active");
  const [categoryId, setCategoryId] = useState("");
  const [dateFilter, setDateFilter] = useState<NoteDateFilter>("any");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sort, setSort] = useState<NoteSort>("updated");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onFocus() {
      searchRef.current?.focus();
    }
    window.addEventListener("cashio:focus-note-search", onFocus);
    return () => window.removeEventListener("cashio:focus-note-search", onFocus);
  }, []);

  const stats = useMemo(() => noteStats(notes), [notes]);
  const reminders = useMemo(() => visibleReminders(notes), [notes]);
  const filtered = useMemo(
    () =>
      sortNotes(
        filterNotes(notes, {
          query: debounced,
          status,
          categoryId: categoryId || undefined,
          dateFilter,
          customStart,
          customEnd,
          categories: noteCategories,
        }),
        sort,
      ),
    [categoryId, customEnd, customStart, dateFilter, debounced, noteCategories, notes, sort, status],
  );

  const pinned = filtered.filter((item) => item.isPinned && status === "active" && !debounced);
  const rest = status === "active" && !debounced && sort === "updated" ? filtered.filter((item) => !item.isPinned) : filtered;
  const showSections = status === "active" && !debounced && sort === "updated";

  const filters = (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select value={categoryId || ALL} onValueChange={(value) => setCategoryId(value === ALL ? "" : value)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {noteCategories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => setStatus(value as NoteStatusFilter)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="pinned">Pinned</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
          <SelectItem value="trash">Trash</SelectItem>
        </SelectContent>
      </Select>
      <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as NoteDateFilter)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any date</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This week</SelectItem>
          <SelectItem value="month">This month</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NOTE_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {dateFilter === "custom" ? (
        <>
          <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
          <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        description="Keep track of ideas, reminders, financial thoughts and important information."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/notes/archive">
            <Archive /> Archive
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/notes/trash">
            <Trash2 /> Trash
          </Link>
        </Button>
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/notes/new">
            <Plus /> New note
          </Link>
        </Button>
      </PageHeader>

      <p className="text-sm text-muted-foreground">
        {stats.total} total · {stats.pinned} pinned · {stats.thisMonth} this month · {stats.withReminders} with
        reminders · {stats.archived} archived
      </p>

      {reminders.length ? (
        <Card className="rounded-lg">
          <CardContent className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bell className="size-3.5" /> Reminders
            </p>
            {reminders.slice(0, 4).map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`} className="block text-sm">
                <span className="font-medium">{note.title} reminder</span>
                <span className="ml-2 text-muted-foreground">
                  {note.reminderAt ? formatNoteDate(note.reminderAt, "d MMM yyyy") : ""}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes..."
            className="h-10 rounded-lg pl-8"
            aria-label="Search notes"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal /> Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            {filters}
          </PopoverContent>
        </Popover>
        <div className="hidden sm:block">
          <Select value={sort} onValueChange={(value) => setSort(value as NoteSort)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : filtered.length ? (
        <div className="space-y-8">
          {showSections && pinned.length ? (
            <section className="space-y-3">
              <h2 className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Pinned</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pinned.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    category={noteCategories.find((item) => item.id === note.categoryId)}
                  />
                ))}
              </div>
            </section>
          ) : null}
          <section className="space-y-3">
            {showSections ? (
              <h2 className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">All notes</h2>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  category={noteCategories.find((item) => item.id === note.categoryId)}
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={debounced ? "No matching notes" : "No notes yet"}
          description={
            debounced
              ? "Try a different search, tag, or category."
              : "Create a note to keep your thoughts, tasks and important information organized."
          }
          actionLabel={debounced ? "New note" : "+ New Note"}
          onAction={() => router.push("/notes/new")}
        />
      )}

      {mobile ? (
        <Link
          href="/notes/new"
          className="fixed right-4 bottom-20 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-hover)] md:hidden"
          aria-label="New note"
        >
          <Plus className="size-5" />
        </Link>
      ) : null}
    </div>
  );
}
