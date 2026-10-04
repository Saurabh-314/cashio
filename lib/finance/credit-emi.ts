import { addMonths, format, parseISO } from "date-fns";
import { accountLabel } from "@/lib/finance/account-label";
import { splitCardEffect } from "@/lib/finance/credit-statements";
import { roundMoney } from "@/lib/finance/money";
import { daysUntil, todayISO } from "@/lib/utils/dates";
import type { Account, BillStatus, CreditEmi, CreditEmiAbsorption, Transaction } from "@/types";

export interface ConvertibleCharge {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface CreditEmiBill {
  id: string;
  emiId: string;
  accountId: string;
  accountName: string;
  name: string;
  dueDate: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  paidPrincipal: number;
  paidInterest: number;
  remaining: number;
}

export interface EmiAbsorptionPlan {
  absorbed: CreditEmiAbsorption[];
  openingAmount: number;
}

function principalSlice(emi: Pick<CreditEmi, "monthlyAmount" | "monthlyInterest">): number {
  return roundMoney(Math.max(0, emi.monthlyAmount - (emi.monthlyInterest ?? 0)));
}

export function emiInstallmentCount(
  principal: number,
  monthlyAmount: number,
  monthlyInterest = 0,
): number {
  const slice = roundMoney(monthlyAmount - monthlyInterest);
  if (slice <= 0 || principal <= 0) return 0;
  let left = roundMoney(principal);
  let count = 0;
  while (left > 0 && count < 360) {
    left = roundMoney(left - Math.min(slice, left));
    count += 1;
  }
  return count;
}

export function nextDueDate(dueDay: number, today: string): string {
  const day = Math.min(31, Math.max(1, Math.round(dueDay || 1)));
  const parsed = parseISO(today);
  const last = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
  const same = format(new Date(parsed.getFullYear(), parsed.getMonth(), Math.min(day, last)), "yyyy-MM-dd");
  if (same >= today) return same;
  const next = addMonths(parsed, 1);
  const nextLast = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  return format(new Date(next.getFullYear(), next.getMonth(), Math.min(day, nextLast)), "yyyy-MM-dd");
}

export function convertibleCharges(
  account: Account,
  transactions: Transaction[],
  accounts: Account[],
  emis: CreditEmi[],
): ConvertibleCharge[] {
  const accountsById = new Map(accounts.map((item) => [item.id, item]));
  const used = new Map<string, number>();
  for (const emi of emis) {
    if (emi.accountId !== account.id) continue;
    for (const part of emi.absorbed ?? []) {
      used.set(part.transactionId, roundMoney((used.get(part.transactionId) ?? 0) + part.amount));
    }
  }

  return transactions
    .map((tx) => {
      const effect = splitCardEffect(tx, account.id, accountsById);
      const taken = used.get(tx.id) ?? 0;
      const amount = roundMoney(Math.max(0, effect.charge - taken));
      return { id: tx.id, date: tx.date, description: tx.description, amount };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function openingAvailable(account: Account, emis: CreditEmi[]): number {
  const used = emis
    .filter((emi) => emi.accountId === account.id)
    .reduce((sum, emi) => sum + (emi.openingAmount ?? 0), 0);
  return roundMoney(Math.max(0, (account.openingOutstanding ?? 0) - used));
}

export function absorbEmiPrincipal(
  amount: number,
  charges: ConvertibleCharge[],
  selectedIds: string[] | null,
  openingLeft: number,
): EmiAbsorptionPlan {
  let left = roundMoney(amount);
  if (left <= 0) throw new Error("Enter an amount to convert");
  const pool = (selectedIds
    ? charges.filter((item) => selectedIds.includes(item.id))
    : [...charges].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  );
  const absorbed: CreditEmiAbsorption[] = [];
  for (const charge of pool) {
    if (left <= 0) break;
    const take = roundMoney(Math.min(charge.amount, left));
    if (take <= 0) continue;
    absorbed.push({ transactionId: charge.id, amount: take });
    left = roundMoney(left - take);
  }
  const openingAmount = roundMoney(Math.min(Math.max(0, left), Math.max(0, openingLeft)));
  left = roundMoney(left - openingAmount);
  if (left > 0) throw new Error("Amount is more than the card spends that can be converted");
  return { absorbed, openingAmount };
}

interface Installment {
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  paidPrincipal: number;
  paidInterest: number;
}

function schedule(emi: CreditEmi): Installment[] {
  const slice = principalSlice(emi);
  if (slice <= 0 || emi.principalAmount <= 0) return [];
  const interest = roundMoney(Math.max(0, emi.monthlyInterest ?? 0));
  let left = roundMoney(emi.principalAmount);
  const paid = roundMoney(Math.max(0, emi.principalAmount - emi.remainingPrincipal));
  let paidLeft = paid;
  let interestLeft = roundMoney(Math.max(0, emi.interestPaid ?? 0));
  const rows: Installment[] = [];

  for (let index = 0; left > 0 && index < 360; index += 1) {
    const principalAmount = roundMoney(Math.min(slice, left));
    const paidPrincipal = roundMoney(Math.min(principalAmount, paidLeft));
    paidLeft = roundMoney(paidLeft - paidPrincipal);
    const paidInterest = roundMoney(Math.min(interest, interestLeft));
    interestLeft = roundMoney(interestLeft - paidInterest);
    rows.push({
      dueDate: format(addMonths(parseISO(emi.startDate), index), "yyyy-MM-dd"),
      principalAmount,
      interestAmount: interest,
      paidPrincipal,
      paidInterest,
    });
    left = roundMoney(left - principalAmount);
  }

  return rows;
}

function toBill(emi: CreditEmi, accountName: string, row: Installment): CreditEmiBill {
  const amount = roundMoney(row.principalAmount + row.interestAmount);
  const paid = roundMoney(row.paidPrincipal + row.paidInterest);
  return {
    id: `emi:${emi.id}:${row.dueDate}`,
    emiId: emi.id,
    accountId: emi.accountId,
    accountName,
    name: `${emi.name} EMI`,
    dueDate: row.dueDate,
    amount,
    principalAmount: row.principalAmount,
    interestAmount: row.interestAmount,
    paidPrincipal: row.paidPrincipal,
    paidInterest: row.paidInterest,
    remaining: roundMoney(Math.max(0, amount - paid)),
  };
}

export function creditEmiBills(emis: CreditEmi[], accounts: Account[], today = todayISO()): CreditEmiBill[] {
  const bills: CreditEmiBill[] = [];
  for (const emi of emis) {
    const account = accounts.find((item) => item.id === emi.accountId);
    if (!account || account.archived || account.kind !== "credit") continue;
    const name = accountLabel(account);
    const rows = schedule(emi).map((row) => toBill(emi, name, row));
    const unpaid = rows.filter((row) => row.remaining > 0);
    const overdue = unpaid.filter((row) => row.dueDate <= today);
    const upcoming = unpaid.find((row) => row.dueDate > today);
    bills.push(...(overdue.length ? overdue : upcoming ? [upcoming] : []));
  }
  return bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

export function splitEmiPayment(bill: CreditEmiBill, amount: number): { principal: number; interest: number } {
  const pay = roundMoney(amount);
  const unpaidPrincipal = roundMoney(Math.max(0, bill.principalAmount - bill.paidPrincipal));
  const unpaidInterest = roundMoney(Math.max(0, bill.interestAmount - bill.paidInterest));
  const principal = roundMoney(Math.min(pay, unpaidPrincipal));
  const interest = roundMoney(Math.min(Math.max(0, pay - principal), unpaidInterest));
  return { principal, interest };
}

export function emiBillStatus(bill: { remaining: number; dueDate: string }, today = todayISO()): BillStatus {
  if (bill.remaining <= 0) return "paid";
  const days = daysUntil(bill.dueDate, today);
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  return "upcoming";
}
