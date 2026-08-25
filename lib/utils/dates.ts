import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import type { DateFormat, RecurringFrequency } from "@/types";

export function todayISO(date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function monthKey(date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function parseDate(value: string): Date {
  return parseISO(value);
}

export function formatDate(value: string, pattern: DateFormat = "dd MMM yyyy"): string {
  return format(parseISO(value), pattern);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function monthRange(date = new Date(), monthStartDay = 1): { start: string; end: string } {
  if (monthStartDay <= 1) {
    return {
      start: format(startOfMonth(date), "yyyy-MM-dd"),
      end: format(endOfMonth(date), "yyyy-MM-dd"),
    };
  }

  const day = date.getDate();
  const start =
    day >= monthStartDay
      ? new Date(date.getFullYear(), date.getMonth(), monthStartDay)
      : new Date(date.getFullYear(), date.getMonth() - 1, monthStartDay);
  const end = addDays(addMonths(start, 1), -1);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

export function previousMonthRange(date = new Date(), monthStartDay = 1) {
  return monthRange(subMonths(date, 1), monthStartDay);
}

export function lastNMonthsRange(months: number, date = new Date()) {
  const end = endOfMonth(date);
  const start = startOfMonth(subMonths(date, months - 1));
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

export function yearRange(date = new Date()) {
  return {
    start: format(startOfYear(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function daysUntil(date: string, from = todayISO()): number {
  return differenceInCalendarDays(parseISO(date), parseISO(from));
}

export function isToday(date: string): boolean {
  return isSameDay(parseISO(date), new Date());
}

export function nextOccurrence(
  from: string,
  frequency: RecurringFrequency | "once",
): string {
  const date = parseISO(from);
  switch (frequency) {
    case "daily":
      return format(addDays(date, 1), "yyyy-MM-dd");
    case "weekly":
      return format(addWeeks(date, 1), "yyyy-MM-dd");
    case "monthly":
      return format(addMonths(date, 1), "yyyy-MM-dd");
    case "quarterly":
      return format(addMonths(date, 3), "yyyy-MM-dd");
    case "yearly":
      return format(addYears(date, 1), "yyyy-MM-dd");
    default:
      return from;
  }
}

export function monthsBetween(start: string, end: string): number {
  return Math.max(1, differenceInCalendarMonths(parseISO(end), parseISO(start)));
}

export function enumerateMonths(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = startOfMonth(parseISO(start));
  const last = startOfMonth(parseISO(end));
  while (cursor <= last) {
    months.push(format(cursor, "yyyy-MM"));
    cursor = addMonths(cursor, 1);
  }
  return months;
}
