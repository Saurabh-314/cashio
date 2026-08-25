import {
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfDay,
  endOfDay,
  endOfMonth,
  isSameDay,
  format,
  isValid,
} from "date-fns";
import { RELATED_TYPE_LABEL } from "@/constants/notes";
import type {
  Account,
  Activity,
  Bill,
  Goal,
  Loan,
  Note,
  NoteCategory,
  NoteDateFilter,
  NoteRelatedType,
  NoteSort,
  NoteStatusFilter,
  ServiceProvider,
  Transaction,
} from "@/types";

const CHECKBOX_RE = /^(\s*)[-*] \[([ xX])\] (.*)$/;

export function previewText(content: string, max = 140): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

export function checklistProgress(content: string): { total: number; done: number } {
  const lines = content.split("\n");
  let total = 0;
  let done = 0;
  for (const line of lines) {
    const match = line.match(CHECKBOX_RE);
    if (!match) continue;
    total += 1;
    if (match[2].toLowerCase() === "x") done += 1;
  }
  return { total, done };
}

export function hasChecklist(content: string): boolean {
  return checklistProgress(content).total > 0;
}

export function toggleChecklistItem(content: string, index: number): string {
  let current = -1;
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(CHECKBOX_RE);
      if (!match) return line;
      current += 1;
      if (current !== index) return line;
      const checked = match[2].toLowerCase() === "x";
      return `${match[1]}- [${checked ? " " : "x"}] ${match[3]}`;
    })
    .join("\n");
}

export function convertChecklistToNote(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(CHECKBOX_RE);
      if (!match) return line;
      return `${match[1]}- ${match[3]}`;
    })
    .join("\n");
}

export function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(/[,#]+/)) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export function noteMatchesQuery(note: Note, query: string, categoryName?: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [note.title, note.content, categoryName ?? "", ...note.tags].join(" ").toLowerCase().includes(q);
}

function inDateFilter(
  note: Note,
  dateFilter: NoteDateFilter,
  customStart?: string,
  customEnd?: string,
): boolean {
  if (dateFilter === "any") return true;
  const at = parseISO(note.updatedAt);
  if (!isValid(at)) return true;
  const now = new Date();
  if (dateFilter === "today") return isSameDay(at, now);
  if (dateFilter === "week") {
    return isWithinInterval(at, {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    });
  }
  if (dateFilter === "month") {
    return isWithinInterval(at, { start: startOfMonth(now), end: endOfMonth(now) });
  }
  if (dateFilter === "custom" && customStart && customEnd) {
    return isWithinInterval(at, {
      start: startOfDay(parseISO(customStart)),
      end: endOfDay(parseISO(customEnd)),
    });
  }
  return true;
}

export function noteMatchesStatus(note: Note, status: NoteStatusFilter): boolean {
  if (status === "trash") return note.isDeleted;
  if (note.isDeleted) return false;
  if (status === "archived") return note.isArchived;
  if (status === "pinned") return note.isPinned && !note.isArchived;
  return !note.isArchived;
}

export function filterNotes(
  notes: Note[],
  options: {
    query: string;
    status: NoteStatusFilter;
    categoryId?: string;
    dateFilter: NoteDateFilter;
    customStart?: string;
    customEnd?: string;
    categories: NoteCategory[];
  },
): Note[] {
  return notes.filter((note) => {
    if (!noteMatchesStatus(note, options.status)) return false;
    if (options.categoryId && note.categoryId !== options.categoryId) return false;
    if (!inDateFilter(note, options.dateFilter, options.customStart, options.customEnd)) return false;
    const categoryName = options.categories.find((item) => item.id === note.categoryId)?.name;
    return noteMatchesQuery(note, options.query, categoryName);
  });
}

export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const next = [...notes];
  next.sort((a, b) => {
    if (sort === "pinned") {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (sort === "az") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (sort === "za") return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return next;
}

export function noteStats(notes: Note[]) {
  const active = notes.filter((item) => !item.isDeleted && !item.isArchived);
  const monthStart = startOfMonth(new Date()).toISOString();
  return {
    total: active.length,
    pinned: active.filter((item) => item.isPinned).length,
    thisMonth: active.filter((item) => item.createdAt >= monthStart).length,
    withReminders: active.filter((item) => Boolean(item.reminderAt)).length,
    archived: notes.filter((item) => item.isArchived && !item.isDeleted).length,
    trash: notes.filter((item) => item.isDeleted).length,
  };
}

export function reminderState(note: Note, now = new Date()): "none" | "upcoming" | "due" | "past" {
  if (!note.reminderAt || note.isDeleted) return "none";
  const at = parseISO(note.reminderAt);
  if (!isValid(at)) return "none";
  if (isSameDay(at, now) || (at <= now && isSameDay(at, now))) return "due";
  if (at <= now) return "past";
  return "upcoming";
}

export function isReminderDue(note: Note, now = new Date()): boolean {
  if (!note.reminderAt || note.isDeleted || note.isArchived) return false;
  const at = parseISO(note.reminderAt);
  if (!isValid(at)) return false;
  return at <= endOfDay(now);
}

export function visibleReminders(notes: Note[], now = new Date()): Note[] {
  return notes
    .filter((note) => isReminderDue(note, now))
    .sort((a, b) => (a.reminderAt ?? "").localeCompare(b.reminderAt ?? ""));
}

export function relatedEntityHref(type: NoteRelatedType, id: string): string {
  if (type === "account") return `/accounts/${id}`;
  if (type === "activity") return `/daily-check/${id}`;
  if (type === "provider") return "/daily-check";
  if (type === "transaction") return "/transactions";
  if (type === "bill") return "/bills";
  if (type === "goal") return "/goals";
  return "/loans";
}

export function relatedEntityLabel(
  type: NoteRelatedType,
  id: string,
  lookup: {
    accounts: Account[];
    activities: Activity[];
    providers: ServiceProvider[];
    transactions: Transaction[];
    bills: Bill[];
    goals: Goal[];
    loans: Loan[];
  },
): string {
  const prefix = RELATED_TYPE_LABEL[type];
  const name =
    type === "account"
      ? lookup.accounts.find((item) => item.id === id)?.name
      : type === "activity"
        ? lookup.activities.find((item) => item.id === id)?.name
        : type === "provider"
          ? lookup.providers.find((item) => item.id === id)?.name
          : type === "transaction"
            ? lookup.transactions.find((item) => item.id === id)?.description
            : type === "bill"
              ? lookup.bills.find((item) => item.id === id)?.name
              : type === "goal"
                ? lookup.goals.find((item) => item.id === id)?.name
                : lookup.loans.find((item) => item.id === id)?.name;
  return name ? `${prefix} → ${name}` : prefix;
}

export function notesForEntity(notes: Note[], type: NoteRelatedType, id: string): Note[] {
  return sortNotes(
    notes.filter(
      (note) =>
        !note.isDeleted &&
        note.relatedEntity?.type === type &&
        note.relatedEntity.id === id,
    ),
    "updated",
  );
}

export function formatNoteDate(value: string, pattern = "d MMM"): string {
  const date = parseISO(value);
  if (!isValid(date)) return "";
  return format(date, pattern);
}

export function newNoteHref(input?: {
  relatedType?: NoteRelatedType;
  relatedId?: string;
  title?: string;
  template?: string;
  category?: string;
}): string {
  const params = new URLSearchParams();
  if (input?.relatedType) params.set("relatedType", input.relatedType);
  if (input?.relatedId) params.set("relatedId", input.relatedId);
  if (input?.title) params.set("title", input.title);
  if (input?.template) params.set("template", input.template);
  if (input?.category) params.set("category", input.category);
  const query = params.toString();
  return query ? `/notes/new?${query}` : "/notes/new";
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
