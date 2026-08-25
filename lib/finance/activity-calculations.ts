import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  getISOWeek,
  getYear,
  isAfter,
  isBefore,
  lastDayOfMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import { WEEKDAYS } from "@/constants/activities";
import { roundMoney } from "@/lib/finance/money";
import { todayISO } from "@/lib/utils/dates";
import type {
  Activity,
  ActivityCheckStatus,
  ActivityRecord,
  ActivitySettlement,
  SettlementStatus,
} from "@/types";

export const MON_SAT = [1, 2, 3, 4, 5, 6];

function dateObj(value: string): Date {
  return parseISO(value);
}

export function recordId(activityId: string, date: string): string {
  return `${activityId}_${date}`;
}

export function settlementId(activityId: string, month: string): string {
  return `${activityId}_${month}`;
}

export function isPausedOn(activity: Activity, date: string): boolean {
  if (activity.status === "paused" || activity.status === "archived") return true;
  return (activity.pauses ?? []).some((pause) => date >= pause.startDate && date <= pause.endDate);
}

function lastValidDayOfMonth(anchor: Date, monthDate: Date): Date {
  const last = lastDayOfMonth(monthDate);
  const day = Math.min(getDate(anchor), getDate(last));
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
}

export function matchesFrequency(activity: Activity, date: string): boolean {
  const current = dateObj(date);
  const start = dateObj(activity.startDate);
  if (isBefore(current, start)) return false;
  if (activity.endDate && isAfter(current, dateObj(activity.endDate))) return false;

  const weekday = getDay(current);
  const days = activity.activeDays ?? [];

  switch (activity.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return weekday >= 1 && weekday <= 5;
    case "weekends":
      return weekday === 0 || weekday === 6;
    case "specific_days":
    case "custom":
      return days.length ? days.includes(weekday) : true;
    case "weekly":
      return weekday === getDay(start);
    case "biweekly": {
      const diff = Math.round((current.getTime() - start.getTime()) / 86400000);
      return diff % 14 === 0;
    }
    case "monthly":
      return getDate(current) === getDate(lastValidDayOfMonth(start, current));
    case "quarterly": {
      const monthDiff =
        (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
      return monthDiff % 3 === 0 && getDate(current) === getDate(lastValidDayOfMonth(start, current));
    }
    default:
      return days.length ? days.includes(weekday) : true;
  }
}

export function isExpectedDay(activity: Activity, date: string): boolean {
  if (activity.status === "archived") return false;
  if (isPausedOn(activity, date)) return false;
  return matchesFrequency(activity, date);
}

export function expectedDatesInRange(activity: Activity, start: string, end: string): string[] {
  if (end < start) return [];
  const from = start < activity.startDate ? activity.startDate : start;
  const to = activity.endDate && activity.endDate < end ? activity.endDate : end;
  if (to < from) return [];
  return eachDayOfInterval({ start: dateObj(from), end: dateObj(to) })
    .map((day) => format(day, "yyyy-MM-dd"))
    .filter((day) => isExpectedDay(activity, day));
}

export function monthBounds(month: string): { start: string; end: string } {
  const start = startOfMonth(parseISO(`${month}-01`));
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(endOfMonth(start), "yyyy-MM-dd"),
  };
}

export function recordAmount(activity: Activity, quantity: number, month: string): number {
  const qty = Math.max(0, quantity || activity.defaultQuantity || 1);
  const { start, end } = monthBounds(month);
  const expected = expectedDatesInRange(activity, start, end).length;

  switch (activity.pricingType) {
    case "daily":
    case "per_visit":
    case "per_unit":
    case "custom":
      return roundMoney(activity.amount * qty);
    case "weekly":
      return 0;
    case "monthly":
      if (activity.frequency === "monthly" || activity.frequency === "quarterly") {
        return roundMoney(activity.amount);
      }
      return expected > 0 ? roundMoney(activity.amount / expected) : 0;
    default:
      return roundMoney(activity.amount * qty);
  }
}

export function occurrenceAmount(activity: Activity, quantity?: number): number {
  const qty = Math.max(0, quantity ?? activity.defaultQuantity ?? 1);
  if (activity.pricingType === "weekly" || activity.pricingType === "monthly") {
    return roundMoney(activity.amount);
  }
  return roundMoney(activity.amount * qty);
}

export function recordsForActivity(
  records: ActivityRecord[],
  activityId: string,
  start?: string,
  end?: string,
): ActivityRecord[] {
  return records.filter((record) => {
    if (record.activityId !== activityId) return false;
    if (start && record.date < start) return false;
    if (end && record.date > end) return false;
    return true;
  });
}

export function dayStatus(
  activity: Activity,
  records: ActivityRecord[],
  date: string,
  today = todayISO(),
): ActivityCheckStatus {
  const record = records.find((item) => item.activityId === activity.id && item.date === date);
  if (record) return record.status;
  if (!matchesFrequency(activity, date) || isPausedOn(activity, date) || activity.status === "archived") {
    return "not_applicable";
  }
  if (!isExpectedDay(activity, date)) return "not_applicable";
  if (date > today) return "pending";
  if (date === today) return "pending";
  return "missed";
}

export interface MonthActivitySummary {
  month: string;
  expectedDays: number;
  completedDays: number;
  skippedDays: number;
  cancelledDays: number;
  missedDays: number;
  notApplicableDays: number;
  quantity: number;
  amount: number;
  rate: number;
}

export function monthSummary(
  activity: Activity,
  records: ActivityRecord[],
  month: string,
  today = todayISO(),
): MonthActivitySummary {
  const { start, end } = monthBounds(month);
  const expectedDates = expectedDatesInRange(activity, start, end);
  const monthRecords = recordsForActivity(records, activity.id, start, end);
  const byDate = new Map(monthRecords.map((item) => [item.date, item]));

  let completedDays = 0;
  let skippedDays = 0;
  let cancelledDays = 0;
  let missedDays = 0;
  let quantity = 0;

  for (const date of expectedDates) {
    const record = byDate.get(date);
    const status = record?.status ?? (date > today ? "pending" : date === today ? "pending" : "missed");
    if (status === "completed") {
      completedDays += 1;
      quantity += record?.quantity ?? activity.defaultQuantity ?? 1;
    } else if (status === "skipped") skippedDays += 1;
    else if (status === "cancelled") cancelledDays += 1;
    else if (status === "missed") missedDays += 1;
  }

  const expectedDays = expectedDates.length;
  const rate = expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0;
  const amount = monthAmount(activity, monthRecords, expectedDays, completedDays, quantity);

  const allDays = eachDayOfInterval({ start: dateObj(start), end: dateObj(end) }).map((day) =>
    format(day, "yyyy-MM-dd"),
  );
  const notApplicableDays = allDays.filter((date) => !expectedDates.includes(date)).length;

  return {
    month,
    expectedDays,
    completedDays,
    skippedDays,
    cancelledDays,
    missedDays,
    notApplicableDays,
    quantity,
    amount,
    rate,
  };
}

function monthAmount(
  activity: Activity,
  monthRecords: ActivityRecord[],
  expectedDays: number,
  completedDays: number,
  quantity: number,
): number {
  const completed = monthRecords.filter((item) => item.status === "completed");
  switch (activity.pricingType) {
    case "daily":
    case "per_visit":
    case "per_unit":
    case "custom":
      return roundMoney(activity.amount * quantity);
    case "weekly": {
      const weeks = new Set(
        completed.map((item) => `${getYear(dateObj(item.date))}-${getISOWeek(dateObj(item.date))}`),
      );
      return roundMoney(activity.amount * weeks.size);
    }
    case "monthly":
      if (activity.frequency === "monthly" || activity.frequency === "quarterly") {
        return completedDays > 0 || expectedDays > 0 ? roundMoney(activity.amount) : 0;
      }
      if (expectedDays <= 0) return 0;
      return roundMoney((activity.amount / expectedDays) * completedDays);
    default:
      return roundMoney(completed.reduce((sum, item) => sum + item.calculatedAmount, 0));
  }
}

export function deriveSettlementStatus(
  amount: number,
  paidAmount: number,
  month: string,
  today = todayISO(),
): SettlementStatus {
  if (amount <= 0 && paidAmount <= 0) return "unpaid";
  if (paidAmount >= amount - 0.009 && amount > 0) return "paid";
  if (paidAmount > 0) return "partially_paid";
  const monthEnd = monthBounds(month).end;
  if (monthEnd < today.slice(0, 10) && amount > 0) return "overdue";
  return "unpaid";
}

export interface ActivityStreaks {
  current: number;
  best: number;
}

export function activityStreaks(
  activity: Activity,
  records: ActivityRecord[],
  today = todayISO(),
): ActivityStreaks {
  const start = activity.startDate;
  const dates = expectedDatesInRange(activity, start, today);
  const completed = new Set(
    records.filter((item) => item.activityId === activity.id && item.status === "completed").map((item) => item.date),
  );
  const skipped = new Set(
    records
      .filter(
        (item) =>
          item.activityId === activity.id &&
          (item.status === "skipped" || item.status === "cancelled" || item.status === "not_applicable"),
      )
      .map((item) => item.date),
  );

  let current = 0;
  let best = 0;
  let run = 0;
  for (const date of dates) {
    if (skipped.has(date) || isPausedOn(activity, date)) continue;
    if (completed.has(date)) {
      run += 1;
      best = Math.max(best, run);
    } else if (date < today) {
      run = 0;
    }
  }
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const date = dates[i];
    if (skipped.has(date) || isPausedOn(activity, date)) continue;
    if (date === today && !completed.has(date)) continue;
    if (completed.has(date)) current += 1;
    else break;
  }
  return { current, best };
}

export interface TodayActivityRow {
  activity: Activity;
  status: ActivityCheckStatus;
  amount: number;
  expected: boolean;
}

export function todayRows(
  activities: Activity[],
  records: ActivityRecord[],
  date = todayISO(),
): TodayActivityRow[] {
  const month = date.slice(0, 7);
  return activities
    .filter((activity) => activity.status !== "archived")
    .map((activity) => {
      const expected = isExpectedDay(activity, date);
      const status = dayStatus(activity, records, date);
      const record = records.find((item) => item.activityId === activity.id && item.date === date);
      const amount =
        record?.calculatedAmount ??
        (status === "completed" || expected ? recordAmount(activity, activity.defaultQuantity, month) : 0);
      return { activity, status, amount, expected };
    })
    .filter((row) => row.expected || row.status === "completed" || row.status === "skipped" || row.status === "cancelled")
    .sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending"));
}

export interface CheckStats {
  total: number;
  completed: number;
  skipped: number;
  pending: number;
  missed: number;
  cancelled: number;
  rate: number;
}

export function todayStats(rows: TodayActivityRow[]): CheckStats {
  const expected = rows.filter((row) => row.expected || row.status !== "not_applicable");
  const completed = expected.filter((row) => row.status === "completed").length;
  const skipped = expected.filter((row) => row.status === "skipped").length;
  const pending = expected.filter((row) => row.status === "pending").length;
  const cancelled = expected.filter((row) => row.status === "cancelled").length;
  const missed = expected.filter((row) => row.status === "missed").length;
  const total = expected.length;
  return {
    total,
    completed,
    skipped,
    pending,
    missed,
    cancelled,
    rate: total > 0 ? (completed / total) * 100 : 0,
  };
}

export function monthStats(
  activities: Activity[],
  records: ActivityRecord[],
  month: string,
  today = todayISO(),
): CheckStats {
  const summaries = activities
    .filter((activity) => activity.status !== "archived")
    .map((activity) => monthSummary(activity, records, month, today));
  const expected = summaries.reduce((sum, item) => sum + item.expectedDays, 0);
  const completed = summaries.reduce((sum, item) => sum + item.completedDays, 0);
  const skipped = summaries.reduce((sum, item) => sum + item.skippedDays, 0);
  const missed = summaries.reduce((sum, item) => sum + item.missedDays, 0);
  const cancelled = summaries.reduce((sum, item) => sum + item.cancelledDays, 0);
  return {
    total: expected,
    completed,
    skipped,
    pending: Math.max(0, expected - completed - skipped - missed - cancelled),
    missed,
    cancelled,
    rate: expected > 0 ? (completed / expected) * 100 : 0,
  };
}

export function formatSchedule(activity: Activity): string {
  const days = activity.activeDays ?? [];
  if (activity.frequency === "daily") return "Every day";
  if (activity.frequency === "weekdays") return "Monday–Friday";
  if (activity.frequency === "weekends") return "Saturday–Sunday";
  if (activity.frequency === "weekly") return "Weekly";
  if (activity.frequency === "biweekly") return "Every 2 weeks";
  if (activity.frequency === "monthly") return "Monthly";
  if (activity.frequency === "quarterly") return "Quarterly";
  if (!days.length) return "Custom";
  if (days.length === 7) return "Every day";
  const ordered = WEEKDAYS.filter((day) => days.includes(day.id));
  if (ordered.map((day) => day.id).join() === MON_SAT.join()) return "Monday–Saturday";
  if (ordered.length <= 3) return ordered.map((day) => day.label).join(", ");
  return ordered.map((day) => day.short).join(" · ");
}

export function pricingLabel(activity: Activity): string {
  const unit =
    activity.unit ||
    (activity.pricingType === "daily"
      ? "day"
      : activity.pricingType === "weekly"
        ? "week"
        : activity.pricingType === "monthly"
          ? "month"
          : activity.pricingType === "per_visit"
            ? "visit"
            : activity.unit || "unit");
  return `${unit}`;
}

export function remainingDue(settlement: Pick<ActivitySettlement, "amount" | "paidAmount">): number {
  return roundMoney(Math.max(0, settlement.amount - settlement.paidAmount));
}

export function previewSettlement(
  activity: Activity,
  records: ActivityRecord[],
  month: string,
  existing?: ActivitySettlement,
  today = todayISO(),
) {
  const summary = monthSummary(activity, records, month, today);
  const paidAmount = existing?.locked ? existing.paidAmount : (existing?.paidAmount ?? 0);
  const amount = existing?.locked ? existing.amount : summary.amount;
  return {
    ...summary,
    amount,
    paidAmount,
    status: deriveSettlementStatus(amount, paidAmount, month, today),
    due: roundMoney(Math.max(0, amount - paidAmount)),
  };
}

export function previousMonth(month: string): string {
  return format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM");
}
