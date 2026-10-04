import { addDays, endOfMonth, format, parseISO } from "date-fns";
import { accountLabel } from "@/lib/finance/account-label";
import { transactionDeltas } from "@/lib/finance/calculations";
import { roundMoney } from "@/lib/finance/money";
import { daysUntil, todayISO } from "@/lib/utils/dates";
import type { Account, BillStatus, CreditEmi, Transaction } from "@/types";

export interface CreditStatement {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  cycleStart: string | null;
  cycleEnd: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
}

export interface UnbilledCredit {
  accountId: string;
  accountName: string;
  cycleStart: string;
  statementDate: string;
  amount: number;
}

export interface CreditStatementView {
  statements: CreditStatement[];
  unbilled: UnbilledCredit[];
}

interface DraftStatement {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  cycleStart: string | null;
  cycleEnd: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
}

interface Cycle {
  start: string;
  end: string;
}

function clampDay(day: number, fallback: number): number {
  if (!Number.isFinite(day)) return fallback;
  return Math.min(31, Math.max(1, Math.round(day)));
}

function dateOnDay(year: number, monthIndex: number, day: number): string {
  const last = endOfMonth(new Date(year, monthIndex, 1)).getDate();
  return format(new Date(year, monthIndex, Math.min(day, last)), "yyyy-MM-dd");
}

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

function previousBillingDate(cycleEnd: string, billingDay: number): string {
  const end = parseISO(cycleEnd);
  const prev = shiftMonth(end.getFullYear(), end.getMonth(), -1);
  return dateOnDay(prev.year, prev.monthIndex, billingDay);
}

export function statementDueDate(cycleEnd: string, dueDay: number): string {
  const parsed = parseISO(cycleEnd);
  const same = dateOnDay(parsed.getFullYear(), parsed.getMonth(), dueDay);
  if (same > cycleEnd) return same;
  const next = shiftMonth(parsed.getFullYear(), parsed.getMonth(), 1);
  return dateOnDay(next.year, next.monthIndex, dueDay);
}

function dueOnOrAfter(date: string, dueDay: number): string {
  const day = date.slice(0, 10);
  const parsed = parseISO(day);
  const same = dateOnDay(parsed.getFullYear(), parsed.getMonth(), dueDay);
  if (same >= day) return same;
  const next = shiftMonth(parsed.getFullYear(), parsed.getMonth(), 1);
  return dateOnDay(next.year, next.monthIndex, dueDay);
}

export function upcomingStatementDate(billingDay: number, today: string): string {
  const current = parseISO(today);
  const thisMonth = dateOnDay(current.getFullYear(), current.getMonth(), billingDay);
  if (thisMonth > today) return thisMonth;
  const next = shiftMonth(current.getFullYear(), current.getMonth(), 1);
  return dateOnDay(next.year, next.monthIndex, billingDay);
}

export function closedStatementCycles(billingDay: number, earliest: string, today: string): Cycle[] {
  const first = parseISO(earliest);
  let { year, monthIndex } = shiftMonth(first.getFullYear(), first.getMonth(), -1);
  const cycles: Cycle[] = [];
  let previousEnd: string | null = null;

  for (let i = 0; i < 240; i++) {
    const end = dateOnDay(year, monthIndex, billingDay);
    if (end > today) break;
    if (end >= earliest) {
      const start = previousEnd
        ? format(addDays(parseISO(previousEnd), 1), "yyyy-MM-dd")
        : format(addDays(parseISO(previousBillingDate(end, billingDay)), 1), "yyyy-MM-dd");
      cycles.push({ start, end });
    }
    previousEnd = end;
    const next = shiftMonth(year, monthIndex, 1);
    year = next.year;
    monthIndex = next.monthIndex;
  }

  return cycles;
}

export function splitCardEffect(
  tx: Transaction,
  accountId: string,
  accountsById: Map<string, Account>,
): { charge: number; refund: number; payment: number } {
  if (tx.type === "transfer" && tx.toAccountId === accountId) {
    return { charge: 0, refund: 0, payment: roundMoney(tx.amount) };
  }
  const delta = transactionDeltas(tx, accountsById)
    .filter((item) => item.accountId === accountId)
    .reduce((sum, item) => sum + item.outstandingDelta, 0);
  if (delta > 0) return { charge: roundMoney(delta), refund: 0, payment: 0 };
  if (delta < 0) return { charge: 0, refund: roundMoney(-delta), payment: 0 };
  return { charge: 0, refund: 0, payment: 0 };
}

function billRemaining(bill: DraftStatement): number {
  return roundMoney(bill.amount - bill.paidAmount);
}

function payBill(bill: DraftStatement, amount: number): number {
  const remaining = billRemaining(bill);
  if (remaining <= 0 || amount <= 0) return roundMoney(Math.max(0, amount));
  const take = Math.min(remaining, amount);
  bill.paidAmount = roundMoney(bill.paidAmount + take);
  return roundMoney(amount - take);
}

function applyCredit(bills: DraftStatement[], amount: number): number {
  let left = roundMoney(amount);
  if (left <= 0) return 0;
  for (const bill of bills) {
    left = payBill(bill, left);
    if (left <= 0) return 0;
  }
  return left;
}

function applyPayment(bills: DraftStatement[], amount: number, statementId?: string): number {
  let left = roundMoney(amount);
  if (left <= 0) return 0;
  if (statementId) {
    const bill = bills.find((item) => item.id === statementId);
    if (bill) return payBill(bill, left);
    return left;
  }
  const cycles = bills.filter((bill) => bill.cycleEnd && billRemaining(bill) > 0);
  const exact = cycles.filter((bill) => billRemaining(bill) === left);
  if (exact.length === 1) return payBill(exact[0], left);
  const ordered = [...bills.filter((bill) => bill.cycleEnd), ...bills.filter((bill) => !bill.cycleEnd)];
  return applyCredit(ordered, left);
}

type StatementEvent =
  | { date: string; kind: "charge"; amount: number; order: number }
  | { date: string; kind: "credit"; amount: number; order: number; payment: boolean; statementId?: string }
  | { date: string; kind: "close"; cycle: Cycle; order: number };

function finish(draft: DraftStatement): CreditStatement {
  const remaining = roundMoney(Math.max(0, draft.amount - draft.paidAmount));
  return { ...draft, remaining };
}

function absorbedCharge(txId: string, accountId: string, emis: CreditEmi[]): number {
  let sum = 0;
  for (const emi of emis) {
    if (emi.accountId !== accountId) continue;
    for (const part of emi.absorbed ?? []) {
      if (part.transactionId === txId) sum = roundMoney(sum + part.amount);
    }
  }
  return sum;
}

function accountStatements(
  account: Account,
  transactions: Transaction[],
  accountsById: Map<string, Account>,
  today: string,
  emis: CreditEmi[],
): { statements: CreditStatement[]; unbilled: UnbilledCredit | null } {
  const billingDay = clampDay(account.billingDay ?? 1, 1);
  const dueDay = clampDay(account.paymentDueDay ?? 10, 10);
  const label = accountLabel(account);
  const effects = transactions
    .map((tx) => ({ tx, effect: splitCardEffect(tx, account.id, accountsById) }))
    .filter((item) => item.effect.charge > 0 || item.effect.refund > 0 || item.effect.payment > 0);

  const openingConverted = roundMoney(
    emis
      .filter((emi) => emi.accountId === account.id)
      .reduce((sum, emi) => sum + (emi.openingAmount ?? 0), 0),
  );
  const opening = roundMoney(Math.max(0, (account.openingOutstanding ?? 0) - openingConverted));
  const bills: DraftStatement[] = [];

  if (opening > 0) {
    const opened = account.createdAt?.slice(0, 10) || today;
    bills.push({
      id: `cc:${account.id}:opening`,
      accountId: account.id,
      accountName: label,
      name: `${label} opening balance`,
      cycleStart: null,
      cycleEnd: null,
      dueDate: dueOnOrAfter(opened, dueDay),
      amount: opening,
      paidAmount: 0,
    });
  }

  const chargeDates = effects
    .filter((item) => {
      if (item.tx.date > today) return false;
      if (item.effect.refund > 0) return true;
      const charge = roundMoney(Math.max(0, item.effect.charge - absorbedCharge(item.tx.id, account.id, emis)));
      return charge > 0;
    })
    .map((item) => item.tx.date)
    .sort();
  const cycles = chargeDates.length ? closedStatementCycles(billingDay, chargeDates[0], today) : [];
  const events: StatementEvent[] = [];

  for (const item of effects) {
    if (item.tx.date > today) continue;
    const charge = roundMoney(Math.max(0, item.effect.charge - absorbedCharge(item.tx.id, account.id, emis)));
    if (charge > 0) {
      events.push({ date: item.tx.date, kind: "charge", amount: charge, order: 0 });
    }
    if (!(item.tx.emiId && item.effect.payment > 0) && item.effect.payment > 0) {
      events.push({
        date: item.tx.date,
        kind: "credit",
        amount: item.effect.payment,
        order: 2,
        payment: true,
        statementId: item.tx.statementId,
      });
    }
    if (item.effect.refund > 0) {
      events.push({
        date: item.tx.date,
        kind: "credit",
        amount: item.effect.refund,
        order: 2,
        payment: false,
      });
    }
  }
  for (const cycle of cycles) {
    events.push({ date: cycle.end, kind: "close", cycle, order: 1 });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  let credit = 0;
  let cycleCharges = 0;
  for (const event of events) {
    if (event.kind === "charge") {
      cycleCharges = roundMoney(cycleCharges + event.amount);
      continue;
    }
    if (event.kind === "credit") {
      const pool = roundMoney(credit + event.amount);
      credit = event.payment ? applyPayment(bills, pool, event.statementId) : applyCredit(bills, pool);
      continue;
    }
    credit = applyCredit(bills, credit);
    if (cycleCharges > 0) {
      const paidOnThis = roundMoney(Math.min(credit, cycleCharges));
      credit = roundMoney(credit - paidOnThis);
      bills.push({
        id: `cc:${account.id}:${event.cycle.end}`,
        accountId: account.id,
        accountName: label,
        name: `${label} statement`,
        cycleStart: event.cycle.start,
        cycleEnd: event.cycle.end,
        dueDate: statementDueDate(event.cycle.end, dueDay),
        amount: cycleCharges,
        paidAmount: paidOnThis,
      });
    }
    cycleCharges = 0;
  }

  const statementDate = upcomingStatementDate(billingDay, today);
  const openStart = cycles.length
    ? format(addDays(parseISO(cycles[cycles.length - 1].end), 1), "yyyy-MM-dd")
    : format(addDays(parseISO(previousBillingDate(statementDate, billingDay)), 1), "yyyy-MM-dd");
  const unbilledAmount = roundMoney(Math.max(0, cycleCharges - applyCredit(bills, credit)));
  const unbilled =
    unbilledAmount > 0
      ? {
          accountId: account.id,
          accountName: label,
          cycleStart: openStart,
          statementDate,
          amount: unbilledAmount,
        }
      : null;

  return {
    statements: bills.filter((bill) => bill.amount > 0).map(finish),
    unbilled,
  };
}

export function creditCardStatements(
  accounts: Account[],
  transactions: Transaction[],
  today = todayISO(),
  emis: CreditEmi[] = [],
): CreditStatementView {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const statements: CreditStatement[] = [];
  const unbilled: UnbilledCredit[] = [];

  for (const account of accounts) {
    if (account.archived || account.kind !== "credit") continue;
    const result = accountStatements(account, transactions, accountsById, today, emis);
    statements.push(...result.statements);
    if (result.unbilled) unbilled.push(result.unbilled);
  }

  return { statements, unbilled };
}

export function listCreditStatements(statements: CreditStatement[]): CreditStatement[] {
  return statements.filter((item) => item.remaining > 0);
}

export function statementStatus(
  statement: { remaining: number; dueDate: string },
  today = todayISO(),
): BillStatus {
  if (statement.remaining <= 0) return "paid";
  const days = daysUntil(statement.dueDate, today);
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  return "upcoming";
}

export function unpaidStatementTotal(statements: CreditStatement[], accountId?: string): number {
  return roundMoney(
    statements
      .filter((item) => item.remaining > 0 && (!accountId || item.accountId === accountId))
      .reduce((sum, item) => sum + item.remaining, 0),
  );
}
