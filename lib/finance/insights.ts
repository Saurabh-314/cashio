import { formatMoney } from "@/lib/finance/money";
import {
  billStatus,
  budgetSpent,
  budgetStatus,
  creditUtilization,
  goalProgress,
  percentChange,
  periodTotals,
  spendingByCategory,
} from "@/lib/finance/calculations";
import { daysUntil } from "@/lib/utils/dates";
import type { Account, Bill, Budget, Category, CurrencyCode, Goal, Insight, Transaction } from "@/types";

export function buildInsights(input: {
  currency: CurrencyCode;
  current: ReturnType<typeof periodTotals>;
  previous: ReturnType<typeof periodTotals>;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  bills: Bill[];
  accounts: Account[];
  goals: Goal[];
  month: string;
  range: { start: string; end: string };
  pendingChecks?: number;
  unpaidServices?: number;
}): Insight[] {
  const insights: Insight[] = [];
  const { currency } = input;

  const savingsDelta = input.current.savingsRate - input.previous.savingsRate;
  if (input.previous.savingsRate !== 0 || input.current.savingsRate !== 0) {
    insights.push({
      id: "savings-rate",
      tone: savingsDelta >= 0 ? "success" : "warning",
      title: savingsDelta >= 0 ? "Savings rate improved" : "Savings rate dipped",
      body: `Your savings rate is ${input.current.savingsRate.toFixed(1)}% this period${
        savingsDelta !== 0 ? `, ${savingsDelta > 0 ? "up" : "down"} ${Math.abs(savingsDelta).toFixed(1)} points.` : "."
      }`,
    });
  }

  const byCategory = spendingByCategory(input.transactions, input.range.start, input.range.end);
  const prevByCategory = spendingByCategory(
    input.transactions,
    // previous period is handled by caller via previous totals; compare top category vs last month using same month window offset in name lookup
    input.range.start,
    input.range.end,
  );

  if (byCategory[0]) {
    const category = input.categories.find((item) => item.id === byCategory[0].categoryId);
    if (category) {
      insights.push({
        id: "top-spend",
        tone: "info",
        title: `${category.name} is your top spend`,
        body: `You spent ${formatMoney(byCategory[0].amount, currency)} on ${category.name} this month.`,
      });
    }
  }

  for (const category of input.categories.filter((item) => item.kind === "expense" && !item.parentId)) {
    const current = byCategory.find((item) => item.categoryId === category.id)?.amount ?? 0;
    const previous = prevByCategory.find((item) => item.categoryId === category.id)?.amount ?? 0;
    const change = percentChange(current, previous);
    if (previous > 0 && Math.abs(change) >= 15 && current > 0) {
      insights.push({
        id: `cat-${category.id}`,
        tone: change > 0 ? "warning" : "success",
        title: `${category.name} spending ${change > 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(0)}%`,
        body: `Compared with the selected previous period, ${category.name} moved to ${formatMoney(current, currency)}.`,
      });
    }
  }

  for (const budget of input.budgets.slice(0, 8)) {
    const spent = budgetSpent(budget, input.transactions, input.month);
    const status = budgetStatus(spent, budget.amount);
    const pct = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
    if (status !== "healthy") {
      insights.push({
        id: `budget-${budget.id}`,
        tone: status === "over" ? "warning" : "info",
        title:
          status === "over"
            ? `${budget.name} is over budget`
            : `You are spending ${pct}% of your ${budget.name} budget`,
        body: `${formatMoney(spent, currency)} of ${formatMoney(budget.amount, currency)} used.`,
      });
    }
  }

  const unpaid = input.bills.filter((bill) => billStatus(bill) !== "paid");
  const upcomingTotal = unpaid.reduce((sum, bill) => sum + bill.amount, 0);
  if (upcomingTotal > 0) {
    insights.push({
      id: "upcoming-bills",
      tone: unpaid.some((bill) => billStatus(bill) === "overdue") ? "warning" : "info",
      title: `You have ${formatMoney(upcomingTotal, currency)} in upcoming bills`,
      body: unpaid
        .slice(0, 3)
        .map((bill) => {
          const days = daysUntil(bill.dueDate);
          const due =
            days < 0 ? "overdue" : days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due in ${days} days`;
          return `${bill.name} ${due}`;
        })
        .join(" · "),
    });
  }

  for (const account of input.accounts.filter((item) => item.kind === "credit" && !item.archived)) {
    const util = creditUtilization(account);
    if (util >= 50) {
      insights.push({
        id: `cc-${account.id}`,
        tone: util >= 70 ? "warning" : "info",
        title: `${account.name} utilization is ${util.toFixed(0)}%`,
        body: "Keeping credit utilization under 30% typically helps your credit profile.",
      });
    }
  }

  for (const goal of input.goals) {
    const progress = goalProgress(goal);
    if (progress.percent >= 100) {
      insights.push({
        id: `goal-${goal.id}`,
        tone: "success",
        title: `${goal.name} is fully funded`,
        body: "Nice work — consider setting a new target.",
      });
    } else if (progress.monthsLeft > 0) {
      insights.push({
        id: `goal-${goal.id}`,
        tone: "info",
        title: `You are on track for ${goal.name}`,
        body: `Save ${formatMoney(progress.monthlyRequired, currency)} / month to reach this by your target date.`,
      });
    }
  }

  if ((input.pendingChecks ?? 0) > 0) {
    insights.unshift({
      id: "daily-check-pending",
      tone: "info",
      title: `${input.pendingChecks} Daily Check ${input.pendingChecks === 1 ? "activity is" : "activities are"} pending`,
      body: "Open Daily Check and mark today's services in a few taps.",
    });
  }

  if ((input.unpaidServices ?? 0) > 0) {
    insights.unshift({
      id: "service-unpaid",
      tone: "warning",
      title: `${formatMoney(input.unpaidServices ?? 0, currency)} unpaid to service providers`,
      body: "Settle milk, maid, and other activity totals from Daily Check → Payments.",
    });
  }

  return insights.slice(0, 8);
}
