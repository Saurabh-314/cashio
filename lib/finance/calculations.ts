import { roundMoney } from "@/lib/finance/money";
import { daysUntil, enumerateMonths, inRange, monthKey, monthsBetween } from "@/lib/utils/dates";
import type {
  Account,
  Bill,
  BillStatus,
  Budget,
  Goal,
  Investment,
  Loan,
  Transaction,
} from "@/types";

export interface BalanceDelta {
  accountId: string;
  balanceDelta: number;
  outstandingDelta: number;
}

export function isCredit(account: Account | undefined): boolean {
  return account?.kind === "credit";
}

export function isAssetAccount(account: Account): boolean {
  return account.kind === "bank" || account.kind === "cash" || account.kind === "other_asset";
}

export function availableCredit(account: Account): number {
  if (!isCredit(account)) return 0;
  return roundMoney(Math.max(0, (account.creditLimit ?? 0) - (account.outstanding ?? 0)));
}

export function creditUtilization(account: Account): number {
  if (!isCredit(account) || !account.creditLimit) return 0;
  return roundMoney(((account.outstanding ?? 0) / account.creditLimit) * 100);
}

export function isUdharTransaction(tx: Pick<Transaction, "type" | "udharId">) {
  return tx.type === "udhar" || Boolean(tx.udharId);
}

export function isUdharInflow(
  tx: Pick<Transaction, "type" | "udharKind" | "udharId" | "repaymentId">,
): boolean {
  if (tx.udharKind === "borrowed" || tx.udharKind === "repayment_received") return true;
  if (tx.udharKind === "lent" || tx.udharKind === "repayment_made") return false;
  return tx.type === "income";
}

export function transactionTypeLabel(tx: Pick<Transaction, "type" | "udharId" | "udharKind" | "repaymentId">) {
  if (isUdharTransaction(tx)) {
    if (tx.udharKind === "lent") return "Lent";
    if (tx.udharKind === "borrowed") return "Borrowed";
    if (tx.udharKind === "repayment_received") return "Payment received";
    if (tx.udharKind === "repayment_made") return "Payment made";
    if (tx.repaymentId) return tx.type === "expense" ? "Payment made" : "Payment received";
    return tx.type === "expense" ? "Lent" : "Borrowed";
  }
  if (tx.type === "income") return "Income";
  if (tx.type === "expense") return "Expense";
  if (tx.type === "transfer") return "Transfer";
  return "People & Udhar";
}

export function signedTransactionAmount(tx: Pick<Transaction, "type" | "amount" | "udharId" | "udharKind" | "repaymentId">) {
  if (tx.type === "transfer") return tx.amount;
  if (isUdharTransaction(tx)) return isUdharInflow(tx) ? tx.amount : -tx.amount;
  return tx.type === "expense" ? -tx.amount : tx.amount;
}

export function transactionAmountTone(
  tx: Pick<Transaction, "type" | "udharId" | "udharKind" | "repaymentId">,
): "income" | "expense" | "neutral" {
  if (tx.type === "transfer") return "neutral";
  if (isUdharTransaction(tx)) return isUdharInflow(tx) ? "income" : "expense";
  return tx.type === "income" ? "income" : tx.type === "expense" ? "expense" : "neutral";
}

export function reportExpenseAmount(tx: Transaction): number {
  if (isUdharTransaction(tx)) {
    return isUdharInflow(tx) ? 0 : tx.interestAmount ?? 0;
  }
  if (tx.type !== "expense") return 0;
  if (tx.loanId && tx.interestAmount != null) return tx.interestAmount;
  return tx.amount;
}

export function reportIncomeAmount(tx: Transaction): number {
  if (isUdharTransaction(tx)) {
    return isUdharInflow(tx) ? tx.interestAmount ?? 0 : 0;
  }
  if (tx.type !== "income") return 0;
  return tx.amount;
}

export function transactionDeltas(
  tx: Pick<
    Transaction,
    | "type"
    | "amount"
    | "accountId"
    | "fromAccountId"
    | "toAccountId"
    | "principalAmount"
    | "udharId"
    | "udharKind"
    | "repaymentId"
  >,
  accountsById: Map<string, Account>,
): BalanceDelta[] {
  const deltas: BalanceDelta[] = [];

  const push = (accountId: string | null, balanceDelta: number, outstandingDelta: number) => {
    if (!accountId) return;
    deltas.push({ accountId, balanceDelta, outstandingDelta });
  };

  const applySingleAccount = (inflow: boolean) => {
    const account = tx.accountId ? accountsById.get(tx.accountId) : undefined;
    if (isCredit(account)) {
      push(tx.accountId, 0, inflow ? -tx.amount : tx.amount);
    } else {
      push(tx.accountId, inflow ? tx.amount : -tx.amount, 0);
    }
  };

  if (tx.type === "udhar" || (tx.type !== "transfer" && tx.udharId)) {
    applySingleAccount(isUdharInflow(tx));
    return deltas;
  }

  if (tx.type === "income") {
    applySingleAccount(true);
    return deltas;
  }

  if (tx.type === "expense") {
    applySingleAccount(false);
    return deltas;
  }

  const from = tx.fromAccountId ? accountsById.get(tx.fromAccountId) : undefined;
  const to = tx.toAccountId ? accountsById.get(tx.toAccountId) : undefined;

  if (isCredit(from)) {
    push(tx.fromAccountId, 0, tx.amount);
  } else {
    push(tx.fromAccountId, -tx.amount, 0);
  }

  if (isCredit(to)) {
    push(tx.toAccountId, 0, -tx.amount);
  } else {
    push(tx.toAccountId, tx.amount, 0);
  }

  return deltas;
}

export function invertDeltas(deltas: BalanceDelta[]): BalanceDelta[] {
  return deltas.map((delta) => ({
    accountId: delta.accountId,
    balanceDelta: -delta.balanceDelta,
    outstandingDelta: -delta.outstandingDelta,
  }));
}

export function applyDeltas(accounts: Account[], deltas: BalanceDelta[]): Account[] {
  const next = accounts.map((account) => ({ ...account }));
  const index = new Map(next.map((account, i) => [account.id, i]));

  for (const delta of deltas) {
    const i = index.get(delta.accountId);
    if (i === undefined) continue;
    const account = next[i];
    if (isCredit(account)) {
      account.outstanding = roundMoney(Math.max(0, account.outstanding + delta.outstandingDelta));
    } else {
      account.currentBalance = roundMoney(account.currentBalance + delta.balanceDelta);
    }
  }

  return next;
}

export function transactionBalanceAfter(
  accounts: Account[],
  transactions: Transaction[],
): Map<string, Map<string, number>> {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const byAccount = new Map<string, { tx: Transaction; balanceDelta: number; outstandingDelta: number }[]>();

  for (const tx of transactions) {
    const summed = new Map<string, { balanceDelta: number; outstandingDelta: number }>();
    for (const delta of transactionDeltas(tx, accountsById)) {
      const current = summed.get(delta.accountId) ?? { balanceDelta: 0, outstandingDelta: 0 };
      current.balanceDelta = roundMoney(current.balanceDelta + delta.balanceDelta);
      current.outstandingDelta = roundMoney(current.outstandingDelta + delta.outstandingDelta);
      summed.set(delta.accountId, current);
    }
    for (const [accountId, delta] of summed) {
      const list = byAccount.get(accountId) ?? [];
      list.push({ tx, ...delta });
      byAccount.set(accountId, list);
    }
  }

  const result = new Map<string, Map<string, number>>();
  for (const account of accounts) {
    const events = byAccount.get(account.id) ?? [];
    events.sort(
      (a, b) =>
        b.tx.date.localeCompare(a.tx.date) ||
        b.tx.createdAt.localeCompare(a.tx.createdAt) ||
        b.tx.id.localeCompare(a.tx.id),
    );
    let balance = isCredit(account) ? account.outstanding : account.currentBalance;
    for (const event of events) {
      const row = result.get(event.tx.id) ?? new Map<string, number>();
      row.set(account.id, balance);
      result.set(event.tx.id, row);
      balance = roundMoney(balance - (isCredit(account) ? event.outstandingDelta : event.balanceDelta));
    }
  }
  return result;
}

export function displayedTransactionBalance(
  tx: Pick<Transaction, "id" | "accountId" | "fromAccountId" | "toAccountId">,
  balances: Map<string, Map<string, number>>,
  accountId?: string,
): number | null {
  const row = balances.get(tx.id);
  if (!row) return null;
  const id =
    accountId && row.has(accountId) ? accountId : (tx.accountId ?? tx.fromAccountId ?? tx.toAccountId ?? null);
  if (!id) return null;
  return row.get(id) ?? null;
}

export function deriveAccountState(
  account: Account,
  transactions: Transaction[],
  allAccounts: Account[],
): { currentBalance: number; outstanding: number } {
  const accountsById = new Map(allAccounts.map((item) => [item.id, item]));
  let currentBalance = account.openingBalance;
  let outstanding = account.openingOutstanding;

  for (const tx of transactions) {
    const deltas = transactionDeltas(tx, accountsById);
    for (const delta of deltas) {
      if (delta.accountId !== account.id) continue;
      currentBalance = roundMoney(currentBalance + delta.balanceDelta);
      outstanding = roundMoney(Math.max(0, outstanding + delta.outstandingDelta));
    }
  }

  if (isCredit(account)) {
    return { currentBalance: 0, outstanding };
  }
  return { currentBalance, outstanding: 0 };
}

export function totalLiquidBalance(accounts: Account[]): number {
  return roundMoney(
    accounts
      .filter((account) => !account.archived && (account.kind === "bank" || account.kind === "cash"))
      .reduce((sum, account) => sum + account.currentBalance, 0),
  );
}

export function totalAssets(
  accounts: Account[],
  investments: Investment[],
  loans: Loan[],
  receivable = 0,
): number {
  const accountAssets = accounts
    .filter((account) => !account.archived && isAssetAccount(account))
    .reduce((sum, account) => sum + account.currentBalance, 0);
  const investmentValue = investments.reduce((sum, item) => sum + item.currentValue, 0);
  const moneyLent = loans
    .filter((loan) => loan.loanType === "lent")
    .reduce((sum, loan) => sum + loan.remainingAmount, 0);
  return roundMoney(accountAssets + investmentValue + moneyLent + receivable);
}

export function totalLiabilities(accounts: Account[], loans: Loan[], payable = 0): number {
  const credit = accounts
    .filter((account) => !account.archived && account.kind === "credit")
    .reduce((sum, account) => sum + account.outstanding, 0);
  const debt = loans
    .filter((loan) => loan.loanType !== "lent")
    .reduce((sum, loan) => sum + loan.remainingAmount, 0);
  return roundMoney(credit + debt + payable);
}

export function netWorth(
  accounts: Account[],
  investments: Investment[],
  loans: Loan[],
  receivable = 0,
  payable = 0,
): number {
  return roundMoney(
    totalAssets(accounts, investments, loans, receivable) - totalLiabilities(accounts, loans, payable),
  );
}

export function periodTotals(transactions: Transaction[], start: string, end: string) {
  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    if (!inRange(tx.date, start, end)) continue;
    income += reportIncomeAmount(tx);
    expenses += reportExpenseAmount(tx);
  }
  const savings = roundMoney(income - expenses);
  const savingsRate = income > 0 ? roundMoney((savings / income) * 100) : 0;
  return {
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    savings,
    savingsRate,
  };
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}

export function spendingByCategory(
  transactions: Transaction[],
  start: string,
  end: string,
): { categoryId: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (!inRange(tx.date, start, end)) continue;
    const amount = reportExpenseAmount(tx);
    if (!amount || !tx.categoryId) continue;
    map.set(tx.categoryId, roundMoney((map.get(tx.categoryId) ?? 0) + amount));
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthlySeries(transactions: Transaction[], start: string, end: string) {
  return enumerateMonths(start, end).map((month) => {
    const [year, mon] = month.split("-").map(Number);
    const monthStart = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    const totals = periodTotals(transactions, monthStart, monthEnd);
    return {
      month,
      label: new Date(year, mon - 1, 1).toLocaleString("en-IN", { month: "short" }),
      income: totals.income,
      expenses: totals.expenses,
      net: totals.savings,
    };
  });
}

export function budgetSpent(
  budget: Budget,
  transactions: Transaction[],
  month: string,
): number {
  const start = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  return roundMoney(
    transactions.reduce((sum, tx) => {
      if (!inRange(tx.date, start, end)) return sum;
      const amount = reportExpenseAmount(tx);
      if (!amount) return sum;
      if (budget.scope === "overall") return sum + amount;
      if (budget.scope === "category" && tx.categoryId === budget.categoryId) return sum + amount;
      if (budget.scope === "account" && tx.accountId === budget.accountId) return sum + amount;
      return sum;
    }, 0),
  );
}

export function budgetStatus(spent: number, amount: number): "healthy" | "near" | "over" {
  if (amount <= 0) return "over";
  const ratio = spent / amount;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "near";
  return "healthy";
}

export function goalProgress(goal: Goal) {
  const remaining = roundMoney(Math.max(0, goal.targetAmount - goal.currentAmount));
  const percent = goal.targetAmount > 0 ? roundMoney((goal.currentAmount / goal.targetAmount) * 100) : 0;
  const monthsLeft = monthsBetween(monthKey() + "-01", goal.targetDate);
  const monthlyRequired = monthsLeft > 0 ? roundMoney(remaining / monthsLeft) : remaining;
  return { remaining, percent: Math.min(100, percent), monthlyRequired, monthsLeft };
}

export function loanProgress(loan: Loan) {
  const paid = roundMoney(loan.principalAmount - loan.remainingAmount);
  const percent = loan.principalAmount > 0 ? roundMoney((paid / loan.principalAmount) * 100) : 0;
  return { paid, percent: Math.min(100, Math.max(0, percent)) };
}

export function billStatus(bill: Bill, today = new Date().toISOString().slice(0, 10)): BillStatus {
  if (bill.lastPaidDate && bill.lastPaidDate >= bill.dueDate) return "paid";
  const remaining = daysUntil(bill.dueDate, today);
  if (remaining < 0) return "overdue";
  if (remaining === 0) return "due_today";
  return "upcoming";
}

export function investmentReturn(item: Investment) {
  const pnl = roundMoney(item.currentValue - item.investedAmount);
  const percent = item.investedAmount > 0 ? roundMoney((pnl / item.investedAmount) * 100) : 0;
  return { pnl, percent };
}
