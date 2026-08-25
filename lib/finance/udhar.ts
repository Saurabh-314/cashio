import { roundMoney } from "@/lib/finance/money";
import { daysUntil, enumerateMonths, inRange, todayISO } from "@/lib/utils/dates";
import type {
  Person,
  PersonNote,
  Udhar,
  UdharInterestType,
  UdharPaymentMethod,
  UdharRepayment,
  UdharStatus,
} from "@/types";

export interface InterestBreakdown {
  interestAmount: number;
  totalAmount: number;
}

export interface PersonBalance {
  personId: string;
  totalLent: number;
  totalBorrowed: number;
  paidTowardLent: number;
  paidTowardBorrowed: number;
  theyOwe: number;
  youOwe: number;
  net: number;
  nextDueDate?: string;
  openCount: number;
  overdueCount: number;
}

export interface LedgerRow {
  id: string;
  date: string;
  createdAt: string;
  kind: "lent" | "borrowed" | "repayment_received" | "repayment_made" | "offset";
  description: string;
  amount: number;
  signedAmount: number;
  balance: number;
  udharId: string;
  repaymentId?: string;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  createdAt: string;
  title: string;
  detail?: string;
  outstandingAfter?: number;
}

export function computeInterest(
  principal: number,
  type: UdharInterestType = "none",
  interestAmount = 0,
  interestRate = 0,
): InterestBreakdown {
  const safePrincipal = roundMoney(Math.max(0, principal));
  if (type === "fixed") {
    const interest = roundMoney(Math.max(0, interestAmount));
    return { interestAmount: interest, totalAmount: roundMoney(safePrincipal + interest) };
  }
  if (type === "percentage") {
    const interest = roundMoney(safePrincipal * (Math.max(0, interestRate) / 100));
    return { interestAmount: interest, totalAmount: roundMoney(safePrincipal + interest) };
  }
  return { interestAmount: 0, totalAmount: safePrincipal };
}

export function allocatePayment(
  outstandingPrincipal: number,
  outstandingInterest: number,
  amount: number,
): { principalAmount: number; interestAmount: number } {
  const pay = roundMoney(Math.max(0, amount));
  const principalAmount = roundMoney(Math.min(pay, Math.max(0, outstandingPrincipal)));
  const interestAmount = roundMoney(Math.min(Math.max(0, pay - principalAmount), Math.max(0, outstandingInterest)));
  return { principalAmount, interestAmount };
}

export function deriveUdharStatus(
  udhar: Pick<Udhar, "status" | "totalAmount" | "outstandingAmount" | "dueDate">,
  today = todayISO(),
): UdharStatus {
  if (udhar.status === "cancelled") return "cancelled";
  if (roundMoney(udhar.outstandingAmount) <= 0) return "settled";
  if (udhar.dueDate && udhar.dueDate < today) return "overdue";
  if (roundMoney(udhar.outstandingAmount) < roundMoney(udhar.totalAmount)) return "partially_paid";
  return "active";
}

export function liveUdhar(udhar: Udhar, repayments: UdharRepayment[], today = todayISO()): Udhar {
  if (udhar.status === "cancelled") {
    return {
      ...udhar,
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      outstandingAmount: 0,
      status: "cancelled",
    };
  }

  const related = repayments.filter((item) => item.udharId === udhar.id);
  const paidPrincipal = roundMoney(related.reduce((sum, item) => sum + item.principalAmount, 0));
  const paidInterest = roundMoney(related.reduce((sum, item) => sum + item.interestAmount, 0));
  const outstandingPrincipal = roundMoney(Math.max(0, udhar.principalAmount - paidPrincipal));
  const outstandingInterest = roundMoney(Math.max(0, udhar.interestAmount - paidInterest));
  const outstandingAmount = roundMoney(outstandingPrincipal + outstandingInterest);
  const next = {
    ...udhar,
    outstandingPrincipal,
    outstandingInterest,
    outstandingAmount,
  };
  return { ...next, status: deriveUdharStatus(next, today) };
}

export function liveUdhars(records: Udhar[], repayments: UdharRepayment[], today = todayISO()) {
  return records.map((item) => liveUdhar(item, repayments, today));
}

export function isOpenUdhar(udhar: Udhar) {
  return udhar.status !== "settled" && udhar.status !== "cancelled" && udhar.outstandingAmount > 0;
}

export function udharPaid(udhar: Udhar) {
  return roundMoney(Math.max(0, udhar.totalAmount - udhar.outstandingAmount));
}

export function udharProgress(udhar: Udhar) {
  const paid = udharPaid(udhar);
  const percent = udhar.totalAmount > 0 ? roundMoney((paid / udhar.totalAmount) * 100) : 0;
  return { paid, percent: Math.min(100, Math.max(0, percent)) };
}

export function dueLabel(dueDate?: string | null, today = todayISO()): string {
  if (!dueDate) return "No due date";
  const remaining = daysUntil(dueDate, today);
  if (remaining === 0) return "Due today";
  if (remaining === 1) return "Due tomorrow";
  if (remaining > 1) return `Due in ${remaining} days`;
  const overdue = Math.abs(remaining);
  return overdue === 1 ? "Overdue by 1 day" : `Overdue by ${overdue} days`;
}

export function reminderDue(
  udhar: Udhar,
  today = todayISO(),
  defaultReminderDays = 1,
): boolean {
  if (!isOpenUdhar(udhar) || !udhar.dueDate) return false;
  const remaining = daysUntil(udhar.dueDate, today);
  const days = udhar.reminderDays ?? defaultReminderDays;
  return remaining <= days;
}

export function personBalance(
  personId: string,
  records: Udhar[],
  repayments: UdharRepayment[],
  today = todayISO(),
): PersonBalance {
  const live = liveUdhars(
    records.filter((item) => item.personId === personId),
    repayments,
    today,
  );
  const lent = live.filter((item) => item.type === "lent" && item.status !== "cancelled");
  const borrowed = live.filter((item) => item.type === "borrowed" && item.status !== "cancelled");
  const theyOwe = roundMoney(lent.reduce((sum, item) => sum + item.outstandingAmount, 0));
  const youOwe = roundMoney(borrowed.reduce((sum, item) => sum + item.outstandingAmount, 0));
  const dueDates = live
    .filter(isOpenUdhar)
    .map((item) => item.dueDate)
    .filter((item): item is string => Boolean(item))
    .sort();

  return {
    personId,
    totalLent: roundMoney(lent.reduce((sum, item) => sum + item.principalAmount, 0)),
    totalBorrowed: roundMoney(borrowed.reduce((sum, item) => sum + item.principalAmount, 0)),
    paidTowardLent: roundMoney(lent.reduce((sum, item) => sum + udharPaid(item), 0)),
    paidTowardBorrowed: roundMoney(borrowed.reduce((sum, item) => sum + udharPaid(item), 0)),
    theyOwe,
    youOwe,
    net: roundMoney(theyOwe - youOwe),
    nextDueDate: dueDates[0],
    openCount: live.filter(isOpenUdhar).length,
    overdueCount: live.filter((item) => item.status === "overdue").length,
  };
}

export function peopleBalances(people: Person[], records: Udhar[], repayments: UdharRepayment[], today = todayISO()) {
  return people.map((person) => ({
    person,
    balance: personBalance(person.id, records, repayments, today),
  }));
}

export function udharTotals(records: Udhar[], repayments: UdharRepayment[], today = todayISO()) {
  const live = liveUdhars(records, repayments, today).filter((item) => item.status !== "cancelled");
  const lent = live.filter((item) => item.type === "lent");
  const borrowed = live.filter((item) => item.type === "borrowed");
  const theyOwe = roundMoney(lent.reduce((sum, item) => sum + item.outstandingAmount, 0));
  const youOwe = roundMoney(borrowed.reduce((sum, item) => sum + item.outstandingAmount, 0));
  const interestEarned = roundMoney(
    repayments
      .filter((item) => {
        const udhar = live.find((row) => row.id === item.udharId);
        return udhar?.type === "lent";
      })
      .reduce((sum, item) => sum + item.interestAmount, 0),
  );
  const interestPaid = roundMoney(
    repayments
      .filter((item) => {
        const udhar = live.find((row) => row.id === item.udharId);
        return udhar?.type === "borrowed";
      })
      .reduce((sum, item) => sum + item.interestAmount, 0),
  );

  return {
    totalLent: roundMoney(lent.reduce((sum, item) => sum + item.principalAmount, 0)),
    totalBorrowed: roundMoney(borrowed.reduce((sum, item) => sum + item.principalAmount, 0)),
    theyOwe,
    youOwe,
    net: roundMoney(theyOwe - youOwe),
    interestEarned,
    interestPaid,
  };
}

export function positionCopy(balance: Pick<PersonBalance, "theyOwe" | "youOwe" | "net">, name: string) {
  if (balance.theyOwe > 0 && balance.youOwe > 0) {
    if (balance.net > 0) return `${name} owes you`;
    if (balance.net < 0) return `You owe ${name}`;
    return "Settled on net";
  }
  if (balance.theyOwe > 0) return `${name} owes you`;
  if (balance.youOwe > 0) return `You owe ${name}`;
  return "All settled";
}

export function positionAmount(balance: Pick<PersonBalance, "theyOwe" | "youOwe" | "net">) {
  if (balance.theyOwe > 0 && balance.youOwe > 0) return Math.abs(balance.net);
  if (balance.theyOwe > 0) return balance.theyOwe;
  if (balance.youOwe > 0) return balance.youOwe;
  return 0;
}

export function netHeadline(net: number) {
  if (net > 0) return "receivable";
  if (net < 0) return "you owe";
  return "even";
}

export function buildPersonLedger(
  personId: string,
  records: Udhar[],
  repayments: UdharRepayment[],
  today = todayISO(),
): LedgerRow[] {
  const live = liveUdhars(
    records.filter((item) => item.personId === personId && item.status !== "cancelled"),
    repayments,
    today,
  );
  const events: Omit<LedgerRow, "balance">[] = [];

  for (const udhar of live) {
    events.push({
      id: `udhar-${udhar.id}`,
      date: udhar.date,
      createdAt: udhar.createdAt,
      kind: udhar.type,
      description: udhar.type === "lent" ? "Money lent" : "Money borrowed",
      amount: udhar.totalAmount,
      signedAmount: udhar.type === "lent" ? udhar.totalAmount : -udhar.totalAmount,
      udharId: udhar.id,
      notes: udhar.notes,
    });
  }

  for (const repayment of repayments.filter((item) => item.personId === personId)) {
    const udhar = live.find((item) => item.id === repayment.udharId) ?? records.find((item) => item.id === repayment.udharId);
    if (!udhar || udhar.status === "cancelled") continue;
    const received = udhar.type === "lent";
    events.push({
      id: `repay-${repayment.id}`,
      date: repayment.paymentDate,
      createdAt: repayment.createdAt,
      kind: repayment.isNetOffset ? "offset" : received ? "repayment_received" : "repayment_made",
      description: repayment.isNetOffset
        ? "Net settlement"
        : received
          ? "Repayment received"
          : "Repayment made",
      amount: repayment.amount,
      signedAmount: received ? -repayment.amount : repayment.amount,
      udharId: udhar.id,
      repaymentId: repayment.id,
      notes: repayment.notes,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  let running = 0;
  return events.map((event) => {
    running = roundMoney(running + event.signedAmount);
    return { ...event, balance: running };
  });
}

export function buildPersonTimeline(
  person: Person,
  records: Udhar[],
  repayments: UdharRepayment[],
  today = todayISO(),
): TimelineEvent[] {
  const ledger = buildPersonLedger(person.id, records, repayments, today);
  const created: TimelineEvent[] = records
    .filter((item) => item.personId === person.id)
    .map((item) => ({
      id: `created-${item.id}`,
      date: item.date,
      createdAt: item.createdAt,
      title:
        item.type === "lent"
          ? `You created this lending record`
          : `You created this borrowing record`,
      detail: item.notes,
    }));

  const fromLedger: TimelineEvent[] = ledger.map((row) => ({
    id: row.id,
    date: row.date,
    createdAt: row.createdAt,
    title:
      row.kind === "lent"
        ? `You lent ${formatPlain(row.amount)}`
        : row.kind === "borrowed"
          ? `You borrowed ${formatPlain(row.amount)}`
          : row.kind === "repayment_received"
            ? `You received ${formatPlain(row.amount)}`
            : row.kind === "repayment_made"
              ? `You paid ${formatPlain(row.amount)}`
              : `Net settlement of ${formatPlain(row.amount)}`,
    outstandingAfter: Math.abs(row.balance),
    detail: row.notes,
  }));

  return [...created.filter((item) => !fromLedger.some((row) => row.id === `udhar-${item.id.replace("created-", "")}`)), ...fromLedger].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

function formatPlain(amount: number) {
  return `₹${roundMoney(amount).toLocaleString("en-IN")}`;
}

export function fifoTargets(open: Udhar[], amount: number) {
  const pay = roundMoney(Math.max(0, amount));
  const allocations: { udhar: Udhar; amount: number; principalAmount: number; interestAmount: number }[] = [];
  let remaining = pay;
  const ordered = [...open].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const udhar of ordered) {
    if (remaining <= 0) break;
    const take = roundMoney(Math.min(remaining, udhar.outstandingAmount));
    if (take <= 0) continue;
    const split = allocatePayment(udhar.outstandingPrincipal, udhar.outstandingInterest, take);
    allocations.push({ udhar, amount: take, ...split });
    remaining = roundMoney(remaining - take);
  }
  return { allocations, leftover: remaining };
}

export function planNetSettlement(live: Udhar[]) {
  const openLent = live.filter((item) => item.type === "lent" && isOpenUdhar(item));
  const openBorrowed = live.filter((item) => item.type === "borrowed" && isOpenUdhar(item));
  const receivable = roundMoney(openLent.reduce((sum, item) => sum + item.outstandingAmount, 0));
  const payable = roundMoney(openBorrowed.reduce((sum, item) => sum + item.outstandingAmount, 0));
  const overlap = roundMoney(Math.min(receivable, payable));
  const net = roundMoney(receivable - payable);

  const lentOffsets = fifoTargets(openLent, overlap).allocations;
  const borrowedOffsets = fifoTargets(openBorrowed, overlap).allocations;
  const remainingLent = openLent.map((item) => {
    const offset = lentOffsets.find((row) => row.udhar.id === item.id);
    const next = {
      ...item,
      outstandingAmount: roundMoney(item.outstandingAmount - (offset?.amount ?? 0)),
      outstandingPrincipal: roundMoney(item.outstandingPrincipal - (offset?.principalAmount ?? 0)),
      outstandingInterest: roundMoney(item.outstandingInterest - (offset?.interestAmount ?? 0)),
    };
    return { ...next, status: deriveUdharStatus(next) };
  });
  const remainingBorrowed = openBorrowed.map((item) => {
    const offset = borrowedOffsets.find((row) => row.udhar.id === item.id);
    const next = {
      ...item,
      outstandingAmount: roundMoney(item.outstandingAmount - (offset?.amount ?? 0)),
      outstandingPrincipal: roundMoney(item.outstandingPrincipal - (offset?.principalAmount ?? 0)),
      outstandingInterest: roundMoney(item.outstandingInterest - (offset?.interestAmount ?? 0)),
    };
    return { ...next, status: deriveUdharStatus(next) };
  });

  const cashSide = net >= 0 ? remainingLent.filter(isOpenUdhar) : remainingBorrowed.filter(isOpenUdhar);
  const cashAllocations = fifoTargets(cashSide, Math.abs(net)).allocations;

  return {
    receivable,
    payable,
    overlap,
    net,
    offsets: [
      ...lentOffsets.map((item) => ({ ...item, type: "lent" as const })),
      ...borrowedOffsets.map((item) => ({ ...item, type: "borrowed" as const })),
    ],
    cashAllocations,
    cashDirection: (net >= 0 ? "received" : "paid") as "received" | "paid",
  };
}

export function upcomingUdhar(records: Udhar[], repayments: UdharRepayment[], today = todayISO()) {
  return liveUdhars(records, repayments, today)
    .filter((item) => isOpenUdhar(item) && item.dueDate && item.dueDate >= today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export function overdueUdhar(records: Udhar[], repayments: UdharRepayment[], today = todayISO()) {
  return liveUdhars(records, repayments, today)
    .filter((item) => item.status === "overdue")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export function dailyCheckFollowUps(
  records: Udhar[],
  repayments: UdharRepayment[],
  today = todayISO(),
  defaultReminderDays = 1,
) {
  return liveUdhars(records, repayments, today).filter(
    (item) =>
      item.remindInDailyCheck &&
      isOpenUdhar(item) &&
      reminderDue(item, today, defaultReminderDays) &&
      item.followUpDoneOn !== today,
  );
}

export function udharMonthlySeries(
  records: Udhar[],
  repayments: UdharRepayment[],
  start: string,
  end: string,
) {
  const live = liveUdhars(records, repayments);
  return enumerateMonths(start, end).map((month) => {
    const [year, mon] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    const lent = live
      .filter((item) => item.type === "lent" && item.status !== "cancelled" && inRange(item.date, monthStart, monthEnd))
      .reduce((sum, item) => sum + item.principalAmount, 0);
    const borrowed = live
      .filter((item) => item.type === "borrowed" && item.status !== "cancelled" && inRange(item.date, monthStart, monthEnd))
      .reduce((sum, item) => sum + item.principalAmount, 0);
    const monthRepayments = repayments.filter((item) => inRange(item.paymentDate, monthStart, monthEnd));
    const interestEarned = monthRepayments
      .filter((item) => live.find((row) => row.id === item.udharId)?.type === "lent")
      .reduce((sum, item) => sum + item.interestAmount, 0);
    const interestPaid = monthRepayments
      .filter((item) => live.find((row) => row.id === item.udharId)?.type === "borrowed")
      .reduce((sum, item) => sum + item.interestAmount, 0);
    return {
      month,
      label: new Date(year, mon - 1, 1).toLocaleString("en-IN", { month: "short" }),
      lent: roundMoney(lent),
      borrowed: roundMoney(borrowed),
      interestEarned: roundMoney(interestEarned),
      interestPaid: roundMoney(interestPaid),
    };
  });
}

export function matchesUdharSearch(
  udhar: Udhar,
  person: Person | undefined,
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [person?.name, person?.phone, person?.relationship, String(udhar.principalAmount), udhar.date, udhar.status, udhar.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function matchesPersonSearch(person: Person, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [person.name, person.phone, person.relationship, person.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function notesFor(notes: PersonNote[], personId: string, udharId?: string, repaymentId?: string) {
  return notes
    .filter((note) => {
      if (note.personId !== personId) return false;
      if (repaymentId) return note.repaymentId === repaymentId;
      if (udharId) return note.udharId === udharId && !note.repaymentId;
      return !note.udharId && !note.repaymentId;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const UDHAR_TO_TX_METHOD: Record<UdharPaymentMethod, "upi" | "card" | "netbanking" | "cash" | "other"> = {
  upi: "upi",
  card: "card",
  bank: "netbanking",
  cash: "cash",
  other: "other",
};
