import {
  billStatus,
  budgetSpent,
  budgetStatus,
  creditUtilization,
  goalProgress,
  loanProgress,
  netWorth,
  percentChange,
  periodTotals,
  spendingByCategory,
  totalLiquidBalance,
} from "@/lib/finance/calculations";
import {
  formatQuantityWithUnit,
  monthSummary,
  occurrenceAmount,
  pricingLabel,
} from "@/lib/finance/activity-calculations";
import { isOpenUdhar, liveUdhars, peopleBalances, udharTotals } from "@/lib/finance/udhar";
import { formatMoney, roundMoney } from "@/lib/finance/money";
import { daysUntil, formatDate, monthKey } from "@/lib/utils/dates";
import { parseDateRange } from "@/lib/ai/dates";
import type { DateRange } from "@/lib/ai/types";
import type { FinanceSnapshot } from "@/lib/ai/data";
import type { Account, Category, CurrencyCode } from "@/types";

function money(amount: number, currency: CurrencyCode) {
  return { amount: roundMoney(amount), formatted: formatMoney(amount, currency) };
}

function categoryName(categories: Category[], id: string | null | undefined) {
  if (!id) return "Uncategorized";
  return categories.find((item) => item.id === id)?.name ?? "Uncategorized";
}

function accountName(accounts: Account[], id: string | null | undefined) {
  if (!id) return "Unknown account";
  return accounts.find((item) => item.id === id)?.name ?? "Unknown account";
}

export function getAccountSummary(snapshot: FinanceSnapshot) {
  const { currency } = snapshot.meta;
  const live = snapshot.accounts.filter((item) => !item.archived);
  return {
    liquid: money(totalLiquidBalance(live), currency),
    accounts: live.map((account) => ({
      name: account.name,
      kind: account.kind,
      balance: money(account.kind === "credit" ? account.outstanding : account.currentBalance, currency),
      creditUtilization: account.kind === "credit" ? creditUtilization(account) : undefined,
    })),
  };
}

export function getTransactionSummary(snapshot: FinanceSnapshot, range: DateRange) {
  const { currency } = snapshot.meta;
  const current = periodTotals(snapshot.transactions, range.start, range.end);
  return {
    range: range.label,
    start: range.start,
    end: range.end,
    income: money(current.income, currency),
    expenses: money(current.expenses, currency),
    savings: money(current.savings, currency),
    savingsRate: current.savingsRate,
  };
}

export function getTransactions(snapshot: FinanceSnapshot, range: DateRange, categoryQuery?: string) {
  const { currency, dateFormat } = snapshot.meta;
  const wanted = categoryQuery?.trim().toLowerCase();
  const rows = snapshot.transactions
    .filter((tx) => tx.date >= range.start && tx.date <= range.end)
    .filter((tx) => {
      if (!wanted) return true;
      return categoryName(snapshot.categories, tx.categoryId).toLowerCase().includes(wanted);
    })
    .slice(0, 25)
    .map((tx) => ({
      date: formatDate(tx.date, dateFormat),
      type: tx.type,
      description: tx.description || categoryName(snapshot.categories, tx.categoryId),
      category: categoryName(snapshot.categories, tx.categoryId),
      account: accountName(snapshot.accounts, tx.accountId ?? tx.fromAccountId),
      amount: money(tx.amount, currency),
    }));
  return { range: range.label, count: rows.length, transactions: rows };
}

export function getCategorySpending(snapshot: FinanceSnapshot, range: DateRange) {
  const { currency } = snapshot.meta;
  const rows = spendingByCategory(snapshot.transactions, range.start, range.end).map((item) => ({
    category: categoryName(snapshot.categories, item.categoryId),
    amount: money(item.amount, currency),
  }));
  const total = rows.reduce((sum, item) => sum + item.amount.amount, 0);
  return {
    range: range.label,
    total: money(total, currency),
    categories: rows.map((item) => ({
      ...item,
      share: total > 0 ? roundMoney((item.amount.amount / total) * 100) : 0,
    })),
  };
}

export function getBudgetSummary(snapshot: FinanceSnapshot, month = monthKey(new Date(`${snapshot.meta.today}T00:00:00`))) {
  const { currency } = snapshot.meta;
  return {
    month,
    budgets: snapshot.budgets.map((budget) => {
      const spent = budgetSpent(budget, snapshot.transactions, month);
      const remaining = roundMoney(budget.amount - spent);
      return {
        name: budget.name,
        budget: money(budget.amount, currency),
        spent: money(spent, currency),
        remaining: money(remaining, currency),
        status: budgetStatus(spent, budget.amount),
        percentUsed: budget.amount > 0 ? roundMoney((spent / budget.amount) * 100) : 0,
      };
    }),
  };
}

export function getGoalSummary(snapshot: FinanceSnapshot) {
  const { currency } = snapshot.meta;
  return {
    goals: snapshot.goals.map((goal) => {
      const progress = goalProgress(goal);
      return {
        name: goal.name,
        target: money(goal.targetAmount, currency),
        saved: money(goal.currentAmount, currency),
        remaining: money(progress.remaining, currency),
        percent: progress.percent,
        monthlyRequired: money(progress.monthlyRequired, currency),
        monthsLeft: progress.monthsLeft,
        targetDate: goal.targetDate,
      };
    }),
  };
}

export function getBillSummary(snapshot: FinanceSnapshot) {
  const { currency, today, dateFormat } = snapshot.meta;
  const unpaid = snapshot.bills.filter((bill) => billStatus(bill, today) !== "paid");
  return {
    bills: snapshot.bills.map((bill) => ({
      name: bill.name,
      amount: money(bill.amount, currency),
      dueDate: formatDate(bill.dueDate, dateFormat),
      status: billStatus(bill, today),
      daysUntilDue: daysUntil(bill.dueDate, today),
    })),
    unpaidTotal: money(
      unpaid.reduce((sum, bill) => sum + bill.amount, 0),
      currency,
    ),
  };
}

export function getLoanSummary(snapshot: FinanceSnapshot) {
  const { currency } = snapshot.meta;
  return {
    loans: snapshot.loans.map((loan) => {
      const progress = loanProgress(loan);
      return {
        name: loan.name,
        lender: loan.lender,
        remaining: money(loan.remainingAmount, currency),
        emi: money(loan.emi, currency),
        interestRate: loan.interestRate,
        percentPaid: progress.percent,
        paymentDueDay: loan.paymentDueDay,
      };
    }),
    remainingTotal: money(
      snapshot.loans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
      currency,
    ),
  };
}

export function getPeopleSummary(snapshot: FinanceSnapshot) {
  const { currency } = snapshot.meta;
  const totals = udharTotals(snapshot.udhars, snapshot.udharRepayments, snapshot.meta.today);
  const rows = peopleBalances(snapshot.people, snapshot.udhars, snapshot.udharRepayments, snapshot.meta.today)
    .filter((row) => row.balance.theyOwe > 0 || row.balance.youOwe > 0)
    .sort((a, b) => b.balance.theyOwe - a.balance.theyOwe || b.balance.youOwe - a.balance.youOwe)
    .map(({ person, balance }) => ({
      name: person.name,
      theyOwe: money(balance.theyOwe, currency),
      youOwe: money(balance.youOwe, currency),
      net: money(balance.net, currency),
    }));
  return {
    theyOwe: money(totals.theyOwe, currency),
    youOwe: money(totals.youOwe, currency),
    net: money(totals.net, currency),
    people: rows,
  };
}

export function getUdharSummary(snapshot: FinanceSnapshot, personName?: string) {
  const { currency, dateFormat, today } = snapshot.meta;
  const live = liveUdhars(snapshot.udhars, snapshot.udharRepayments, today).filter(isOpenUdhar);
  const filtered = personName
    ? live.filter((item) => {
        const name = snapshot.people.find((person) => person.id === item.personId)?.name ?? "";
        return name.toLowerCase().includes(personName.toLowerCase());
      })
    : live;
  return {
    records: filtered.map((item) => {
      const person = snapshot.people.find((row) => row.id === item.personId)?.name ?? "Someone";
      return {
        person,
        type: item.type,
        outstanding: money(item.outstandingAmount, currency),
        dueDate: item.dueDate ? formatDate(item.dueDate, dateFormat) : null,
        status: item.status,
      };
    }),
  };
}

export function getDailyCheckSummary(snapshot: FinanceSnapshot, month = monthKey(new Date(`${snapshot.meta.today}T00:00:00`))) {
  const { currency } = snapshot.meta;
  const live = snapshot.activities.filter((item) => item.status !== "archived");
  const rows = live.map((activity) => {
    const summary = monthSummary(activity, snapshot.activityRecords, month, snapshot.meta.today);
    const unitPrice = activity.amount;
    return {
      name: activity.name,
      unitPrice: money(unitPrice, currency),
      unit: pricingLabel(activity),
      quantity: formatQuantityWithUnit(activity.defaultQuantity, activity.unit),
      occurrence: money(occurrenceAmount(activity), currency),
      monthTotal: money(summary.amount, currency),
      completedDays: summary.completedDays,
    };
  });
  const total = rows.reduce((sum, item) => sum + item.monthTotal.amount, 0);
  return { month, activities: rows, total: money(total, currency) };
}

export function getNetWorthSummary(snapshot: FinanceSnapshot) {
  const { currency } = snapshot.meta;
  const people = udharTotals(snapshot.udhars, snapshot.udharRepayments, snapshot.meta.today);
  const worth = netWorth(
    snapshot.accounts,
    snapshot.investments,
    snapshot.loans,
    people.theyOwe,
    people.youOwe,
  );
  return {
    netWorth: money(worth, currency),
    liquid: money(totalLiquidBalance(snapshot.accounts), currency),
    receivable: money(people.theyOwe, currency),
    payable: money(people.youOwe, currency),
  };
}

function dueDateForDay(today: string, day: number): string | null {
  if (!day || day < 1 || day > 31) return null;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const last = new Date(year, month, 0).getDate();
  const dueDay = Math.min(day, last);
  const due = `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
  if (due >= today) return due;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const nextLast = new Date(Number(next.slice(0, 4)), Number(next.slice(5, 7)), 0).getDate();
  return `${next}-${String(Math.min(day, nextLast)).padStart(2, "0")}`;
}

function inWindow(date: string | null | undefined, start: string, end: string) {
  return Boolean(date && date >= start && date <= end);
}

export function getUpcomingCommitments(snapshot: FinanceSnapshot, range: DateRange) {
  const { currency, dateFormat, today } = snapshot.meta;
  const items: { name: string; amount: number; date: string; kind: string }[] = [];

  for (const bill of snapshot.bills) {
    if (billStatus(bill, today) === "paid") continue;
    if (inWindow(bill.dueDate, range.start, range.end) || billStatus(bill, today) === "overdue") {
      items.push({ name: bill.name, amount: bill.amount, date: bill.dueDate, kind: "bill" });
    }
  }

  for (const loan of snapshot.loans) {
    if (loan.loanType === "lent" || loan.emi <= 0) continue;
    const due = dueDateForDay(today, loan.paymentDueDay);
    if (inWindow(due, range.start, range.end)) {
      items.push({ name: `${loan.name} EMI`, amount: loan.emi, date: due as string, kind: "loan" });
    }
  }

  for (const account of snapshot.accounts.filter((item) => item.kind === "credit" && !item.archived)) {
    if (!account.paymentDueDay || account.outstanding <= 0) continue;
    const due = dueDateForDay(today, account.paymentDueDay);
    if (inWindow(due, range.start, range.end)) {
      items.push({ name: `${account.name} due`, amount: account.outstanding, date: due as string, kind: "credit" });
    }
  }

  for (const udhar of liveUdhars(snapshot.udhars, snapshot.udharRepayments, today).filter(isOpenUdhar)) {
    if (!inWindow(udhar.dueDate, range.start, range.end)) continue;
    if (udhar.type !== "borrowed") continue;
    const person = snapshot.people.find((item) => item.id === udhar.personId)?.name ?? "Someone";
    items.push({
      name: `${person} repayment`,
      amount: udhar.outstandingAmount,
      date: udhar.dueDate as string,
      kind: "udhar",
    });
  }

  for (const item of snapshot.recurring) {
    if (item.type !== "expense") continue;
    if (inWindow(item.nextRunDate, range.start, range.end)) {
      items.push({ name: item.description || "Recurring", amount: item.amount, date: item.nextRunDate, kind: "recurring" });
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return {
    range: range.label,
    items: items.map((item) => ({
      name: item.name,
      kind: item.kind,
      date: formatDate(item.date, dateFormat),
      amount: money(item.amount, currency),
    })),
    total: money(total, currency),
  };
}

export function getMonthlyReview(snapshot: FinanceSnapshot, range: DateRange) {
  const current = getTransactionSummary(snapshot, range);
  const previousRange = parseDateRange("last month", new Date(`${snapshot.meta.today}T00:00:00`), snapshot.meta.monthStartDay);
  const previous = getTransactionSummary(snapshot, previousRange);
  const categories = getCategorySpending(snapshot, range);
  const budgets = getBudgetSummary(snapshot);
  const people = getPeopleSummary(snapshot);
  const bills = getUpcomingCommitments(snapshot, parseDateRange("next 7 days", new Date(`${snapshot.meta.today}T00:00:00`)));
  const overBudget = budgets.budgets.filter((item) => item.status === "over").length;
  return {
    title: `${range.label} financial review`,
    income: current.income,
    expenses: current.expenses,
    savings: current.savings,
    savingsRate: current.savingsRate,
    topSpending: categories.categories[0]?.category ?? "None",
    budgetStatus: overBudget > 0 ? `${overBudget} budget${overBudget === 1 ? "" : "s"} over` : "Within budget",
    peopleReceivable: people.theyOwe,
    upcomingBills: bills.total,
    expenseChange: percentChange(current.expenses.amount, previous.expenses.amount),
    categories: categories.categories.slice(0, 5),
  };
}

export function getWeeklyReview(snapshot: FinanceSnapshot) {
  const range = parseDateRange("this week", new Date(`${snapshot.meta.today}T00:00:00`));
  const current = getTransactionSummary(snapshot, range);
  const categories = getCategorySpending(snapshot, range);
  const budgets = getBudgetSummary(snapshot);
  const people = getPeopleSummary(snapshot);
  const upcoming = getUpcomingCommitments(
    snapshot,
    parseDateRange("next 7 days", new Date(`${snapshot.meta.today}T00:00:00`)),
  );
  const used =
    budgets.budgets.length > 0
      ? roundMoney(budgets.budgets.reduce((sum, item) => sum + item.percentUsed, 0) / budgets.budgets.length)
      : 0;
  return {
    title: "Weekly financial review",
    income: current.income,
    expenses: current.expenses,
    saved: current.savings,
    topCategory: categories.categories[0]?.category ?? "None",
    budgetUsedPercent: used,
    peopleReceivable: people.theyOwe,
    upcoming: upcoming.total,
  };
}

export function getFinancialHealth(snapshot: FinanceSnapshot) {
  const month = parseDateRange("this month", new Date(`${snapshot.meta.today}T00:00:00`), snapshot.meta.monthStartDay);
  const totals = getTransactionSummary(snapshot, month);
  const budgets = getBudgetSummary(snapshot);
  const people = getPeopleSummary(snapshot);
  const upcoming = getUpcomingCommitments(
    snapshot,
    parseDateRange("next 7 days", new Date(`${snapshot.meta.today}T00:00:00`)),
  );
  const liquid = totalLiquidBalance(snapshot.accounts);
  const credits = snapshot.accounts.filter((item) => item.kind === "credit" && !item.archived);
  const avgUtil =
    credits.length > 0
      ? credits.reduce((sum, item) => sum + creditUtilization(item), 0) / credits.length
      : 0;
  const budgetOver = budgets.budgets.filter((item) => item.status === "over").length;
  const overdueUdhar = liveUdhars(snapshot.udhars, snapshot.udharRepayments, snapshot.meta.today).filter(
    (item) => item.status === "overdue",
  ).length;

  let score = 50;
  const strengths: string[] = [];
  const watches: string[] = [];

  if (totals.savingsRate >= 20) {
    score += 18;
    strengths.push("Strong savings rate");
  } else if (totals.savingsRate >= 10) {
    score += 10;
  } else if (totals.income.amount > 0) {
    score -= 8;
    watches.push("Savings rate is low this month");
  }

  if (budgets.budgets.length && budgetOver === 0) {
    score += 12;
    strengths.push("Budgets are on track");
  } else if (budgetOver > 0) {
    score -= 10;
    watches.push("One or more budgets are over");
  }

  if (avgUtil <= 30) score += 8;
  else if (avgUtil >= 70) {
    score -= 12;
    watches.push("Credit utilization is elevated");
  }

  if (liquid >= upcoming.total.amount * 2) score += 8;
  else if (upcoming.total.amount > liquid) {
    score -= 10;
    watches.push("Upcoming payments are large relative to cash");
  }

  if (overdueUdhar > 0) {
    score -= 8;
    watches.push("There is overdue udhar");
  }

  if (people.theyOwe.amount > 0 && overdueUdhar === 0) {
    strengths.push("People balances are being tracked");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "Good" : score >= 60 ? "Fair" : "Needs attention";

  return {
    score,
    label,
    disclaimer: "This is an informational Cashio score, not professional financial advice.",
    strengths: strengths.slice(0, 3),
    watches: watches.slice(0, 3),
    savingsRate: totals.savingsRate,
  };
}

export function canAfford(snapshot: FinanceSnapshot, amount: number) {
  const { currency } = snapshot.meta;
  const liquid = totalLiquidBalance(snapshot.accounts);
  const upcoming = getUpcomingCommitments(
    snapshot,
    parseDateRange("next 7 days", new Date(`${snapshot.meta.today}T00:00:00`)),
  );
  const month = parseDateRange("this month", new Date(`${snapshot.meta.today}T00:00:00`), snapshot.meta.monthStartDay);
  const totals = getTransactionSummary(snapshot, month);
  const credit = snapshot.accounts
    .filter((item) => item.kind === "credit" && !item.archived)
    .reduce((sum, item) => sum + item.outstanding, 0);
  const after = roundMoney(liquid - amount);
  const technically = liquid >= amount;
  return {
    amount: money(amount, currency),
    available: money(liquid, currency),
    afterPurchase: money(after, currency),
    upcomingCommitments: upcoming.total,
    creditOutstanding: money(credit, currency),
    monthExpenses: totals.expenses,
    technicallyAffordable: technically,
    disclaimer: "This is budgeting guidance, not professional financial advice. Nothing here is guaranteed.",
  };
}

export function suggestSpendingCuts(snapshot: FinanceSnapshot, target: number) {
  const { currency } = snapshot.meta;
  const range = parseDateRange("this month", new Date(`${snapshot.meta.today}T00:00:00`), snapshot.meta.monthStartDay);
  const categories = getCategorySpending(snapshot, range).categories;
  const discretionary = new Set(["food", "restaurant", "shopping", "entertainment", "subscriptions", "coffee", "fast food"]);
  const suggestions = categories
    .filter((item) => discretionary.has(item.category.toLowerCase()) || item.amount.amount > 0)
    .slice(0, 6)
    .map((item) => {
      const cut = roundMoney(Math.min(item.amount.amount * 0.25, Math.max(0, target)));
      return { category: item.category, current: item.amount, suggestedCut: money(cut, currency) };
    });
  let remaining = target;
  const allocated = suggestions.map((item) => {
    const cut = roundMoney(Math.min(item.suggestedCut.amount, remaining));
    remaining = roundMoney(remaining - cut);
    return { ...item, suggestedCut: money(cut, currency) };
  });
  return {
    target: money(target, currency),
    suggestions: allocated.filter((item) => item.suggestedCut.amount > 0),
    potential: money(target - remaining, currency),
  };
}

export function resolveRange(snapshot: FinanceSnapshot, period?: string): DateRange {
  return parseDateRange(period, new Date(`${snapshot.meta.today}T00:00:00`), snapshot.meta.monthStartDay);
}
