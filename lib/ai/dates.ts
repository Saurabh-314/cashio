import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  nextDay,
  parse,
  previousDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  type Day,
} from "date-fns";
import { monthRange, previousMonthRange } from "@/lib/utils/dates";
import { AI_CONFIG } from "@/lib/ai/config";
import type { DateRange } from "@/lib/ai/types";

const WEEKDAYS: Record<string, Day> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

export function nowInTimezone(timeZone = AI_CONFIG.timezone): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return new Date(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
}

export function todayInTimezone(timeZone = AI_CONFIG.timezone): string {
  return format(nowInTimezone(timeZone), "yyyy-MM-dd");
}

export function parseFlexibleDate(
  raw: string | undefined,
  today = nowInTimezone(),
): string | null {
  if (!raw) return format(today, "yyyy-MM-dd");
  const value = raw.trim().toLowerCase();
  if (!value || value === "today" || value === "aaj") return format(today, "yyyy-MM-dd");
  if (value === "yesterday") return format(addDays(today, -1), "yyyy-MM-dd");
  if (value === "tomorrow" || value === "kal") return format(addDays(today, 1), "yyyy-MM-dd");

  const lastWeekday = value.match(/^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (lastWeekday) {
    return format(previousDay(today, WEEKDAYS[lastWeekday[1]]), "yyyy-MM-dd");
  }
  const nextWeekday = value.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextWeekday) {
    return format(nextDay(today, WEEKDAYS[nextWeekday[1]]), "yyyy-MM-dd");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  for (const pattern of ["d MMM yyyy", "d MMMM yyyy", "dd/MM/yyyy", "d/M/yyyy", "MMMM d", "MMM d"]) {
    const parsed = parse(raw.trim(), pattern, today);
    if (!Number.isNaN(parsed.getTime())) {
      if (pattern === "MMMM d" || pattern === "MMM d") {
        if (parsed > addDays(today, 14)) parsed.setFullYear(parsed.getFullYear() - 1);
      }
      return format(parsed, "yyyy-MM-dd");
    }
  }
  return null;
}

export function parseDateRange(
  raw: string | undefined,
  today = nowInTimezone(),
  monthStartDay = 1,
): DateRange {
  const value = (raw ?? "this month").trim().toLowerCase();
  const iso = format(today, "yyyy-MM-dd");

  if (value === "today") return { start: iso, end: iso, label: "today" };
  if (value === "yesterday") {
    const date = format(addDays(today, -1), "yyyy-MM-dd");
    return { start: date, end: date, label: "yesterday" };
  }
  if (value === "this week") {
    return {
      start: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      end: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      label: "this week",
    };
  }
  if (value === "last week") {
    const end = addDays(startOfWeek(today, { weekStartsOn: 1 }), -1);
    const start = startOfWeek(end, { weekStartsOn: 1 });
    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      label: "last week",
    };
  }
  if (value === "next 7 days" || value === "next week") {
    return {
      start: iso,
      end: format(addDays(today, value === "next week" ? 7 : 6), "yyyy-MM-dd"),
      label: value,
    };
  }
  if (value === "this month") {
    const range = monthRange(today, monthStartDay);
    return { ...range, label: format(today, "MMMM yyyy") };
  }
  if (value === "last month") {
    const range = previousMonthRange(today, monthStartDay);
    return { ...range, label: format(subMonths(today, 1), "MMMM yyyy") };
  }

  const monthName = MONTHS[value];
  if (monthName != null) {
    let year = today.getFullYear();
    if (monthName > today.getMonth() + 1) year -= 1;
    const date = new Date(year, monthName, 1);
    return {
      start: format(startOfMonth(date), "yyyy-MM-dd"),
      end: format(endOfMonth(date), "yyyy-MM-dd"),
      label: format(date, "MMMM yyyy"),
    };
  }

  const monthYear = value.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYear && MONTHS[monthYear[1]] != null) {
    const date = new Date(Number(monthYear[2]), MONTHS[monthYear[1]], 1);
    return {
      start: format(startOfMonth(date), "yyyy-MM-dd"),
      end: format(endOfMonth(date), "yyyy-MM-dd"),
      label: format(date, "MMMM yyyy"),
    };
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1);
    return {
      start: format(startOfMonth(date), "yyyy-MM-dd"),
      end: format(endOfMonth(date), "yyyy-MM-dd"),
      label: format(date, "MMMM yyyy"),
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { start: value, end: value, label: value };
  }

  const range = monthRange(today, monthStartDay);
  return { ...range, label: format(today, "MMMM yyyy") };
}

export function addCalendarDays(isoDate: string, days: number): string {
  return format(addDays(new Date(`${isoDate}T00:00:00`), days), "yyyy-MM-dd");
}

export function daysInRangeInclusive(start: string, end: string): number {
  const from = new Date(`${start}T00:00:00`).getTime();
  const to = new Date(`${end}T00:00:00`).getTime();
  return Math.max(1, Math.round((to - from) / 86400000) + 1);
}
