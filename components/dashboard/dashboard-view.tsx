"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MoneyCard } from "@/components/dashboard/money-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import {
  availableCredit,
  billStatus,
  budgetSpent,
  budgetStatus,
  creditUtilization,
  goalProgress,
  netWorth,
  percentChange,
  periodTotals,
  spendingByCategory,
  monthlySeries,
  totalLiquidBalance,
} from "@/lib/finance/calculations";
import { buildInsights } from "@/lib/finance/insights";
import {
  previewSettlement,
  todayRows,
  todayStats,
} from "@/lib/finance/activity-calculations";
import { CheckStatusBadge } from "@/components/daily-check/status-badge";
import { lastNMonthsRange, monthKey, monthRange, previousMonthRange, todayISO, yearRange, greeting } from "@/lib/utils/dates";
import { daysUntil } from "@/lib/utils/dates";
import {
  dueLabel,
  isOpenUdhar,
  liveUdhars,
  peopleBalances,
  udharTotals,
} from "@/lib/finance/udhar";
import { Wallet } from "lucide-react";
import { format } from "date-fns";
import { previewText, visibleReminders } from "@/lib/notes";

const IncomeExpenseChart = dynamic(
  () => import("@/components/charts/finance-charts").then((mod) => mod.IncomeExpenseChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" /> },
);
const CashFlowChart = dynamic(
  () => import("@/components/charts/finance-charts").then((mod) => mod.CashFlowChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" /> },
);
const SpendingDonut = dynamic(
  () => import("@/components/charts/finance-charts").then((mod) => mod.SpendingDonut),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-muted" /> },
);

const RANGE_OPTIONS = [
  { id: "month", label: "Monthly" },
  { id: "6m", label: "6 months" },
  { id: "12m", label: "12 months" },
  { id: "year", label: "Year" },
] as const;

export function DashboardView() {
  const { profile } = useAuth();
  const { loading, accounts, transactions, categories, budgets, bills, goals, loans, investments, activities, activityRecords, settlements, people, udhars, udharRepayments, notes, openQuickAdd } =
    useFinance();
  const router = useRouter();
  const [rangeId, setRangeId] = useState<(typeof RANGE_OPTIONS)[number]["id"]>("6m");
  const currency = profile?.currency ?? "INR";
  const widgets = profile?.widgets;
  const monthStartDay = profile?.monthStartDay ?? 1;

  const data = useMemo(() => {
    const currentRange = monthRange(new Date(), monthStartDay);
    const previousRange = previousMonthRange(new Date(), monthStartDay);
    const current = periodTotals(transactions, currentRange.start, currentRange.end);
    const previous = periodTotals(transactions, previousRange.start, previousRange.end);
    const chartRange =
      rangeId === "month"
        ? currentRange
        : rangeId === "year"
          ? yearRange()
          : lastNMonthsRange(rangeId === "6m" ? 6 : 12);
    const series = monthlySeries(transactions, chartRange.start, chartRange.end);
    const spend = spendingByCategory(transactions, currentRange.start, currentRange.end).map((item, index) => {
      const category = categories.find((cat) => cat.id === item.categoryId);
      const palette = ["#1F2937", "#2F6B4F", "#7C6F5B", "#B84A4A", "#B7791F", "#737373"];
      return {
        name: category?.name ?? "Other",
        value: item.amount,
        color: palette[index % palette.length],
      };
    });
    const insights = buildInsights({
      currency,
      current,
      previous,
      transactions,
      categories,
      budgets,
      bills,
      accounts,
      goals,
      month: monthKey(),
      range: currentRange,
      pendingChecks: activities.filter((item) => item.status === "active").length
        ? todayStats(todayRows(activities.filter((item) => item.status === "active"), activityRecords)).pending
        : 0,
      unpaidServices: activities
        .reduce((sum, activity) => {
          const existing = settlements.find((item) => item.activityId === activity.id && item.month === monthKey());
          return sum + previewSettlement(activity, activityRecords, monthKey(), existing).due;
        }, 0),
      overdueUdhar: liveUdhars(udhars, udharRepayments)
        .filter((item) => item.status === "overdue")
        .map((item) => ({
          name: people.find((row) => row.id === item.personId)?.name ?? "Someone",
          amount: item.outstandingAmount,
          days: Math.abs(daysUntil(item.dueDate ?? todayISO())),
        })),
    });
    return { currentRange, current, previous, series, spend, insights };
  }, [accounts, activities, activityRecords, bills, budgets, categories, currency, goals, monthStartDay, people, rangeId, settlements, transactions, udharRepayments, udhars]);

  if (loading) return <DashboardSkeleton />;

  if (!accounts.length) {
    return (
      <EmptyState
        icon={Wallet}
        title="Add your first account"
        description="Start by adding a bank, cash, or credit card so Cashio can track your money."
        actionLabel="Add account"
        onAction={() => router.push("/accounts")}
      />
    );
  }

  const show = (key: keyof NonNullable<typeof widgets>) => widgets?.[key] !== false;
  const liquid = totalLiquidBalance(accounts);
  const peopleTotals = udharTotals(udhars, udharRepayments);
  const worth = netWorth(accounts, investments, loans, peopleTotals.theyOwe, peopleTotals.youOwe);
  const cards = accounts.filter((item) => item.kind === "credit" && !item.archived);
  const month = monthKey();
  const liveActivities = activities.filter((item) => item.status !== "archived");
  const checkRows = todayRows(liveActivities, activityRecords, todayISO());
  const checkStats = todayStats(checkRows);
  const dueSettlements = activities
    .map((activity) => {
      const existing = settlements.find((item) => item.activityId === activity.id && item.month === month);
      return { activity, snap: previewSettlement(activity, activityRecords, month, existing) };
    })
    .filter((item) => item.snap.due > 0);

  const firstName = profile?.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div className="sticky top-16 z-20 -mx-4 bg-background/90 px-4 py-4 backdrop-blur-md lg:-mx-10 lg:px-10">
        <h1 className="font-display text-[1.65rem] leading-tight font-medium tracking-tight lg:text-[2rem]">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your financial overview for {format(new Date(), "MMMM")}
        </p>
      </div>

      {data.insights[0] ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium">{data.insights[0].title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{data.insights[0].body}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {show("totalBalance") ? (
          <MoneyCard label="Total balance" amount={liquid} currency={currency} />
        ) : null}
        {show("income") ? (
          <MoneyCard
            label="Monthly income"
            amount={data.current.income}
            currency={currency}
            change={percentChange(data.current.income, data.previous.income)}
            tone="income"
          />
        ) : null}
        {show("expenses") ? (
          <MoneyCard
            label="Monthly expenses"
            amount={data.current.expenses}
            currency={currency}
            change={percentChange(data.current.expenses, data.previous.expenses)}
            tone="expense"
          />
        ) : null}
        {show("savings") ? (
          <MoneyCard
            label="Savings"
            amount={data.current.savings}
            currency={currency}
            hint={`${data.current.savingsRate.toFixed(1)}% savings rate`}
            tone={data.current.savings >= 0 ? "income" : "expense"}
          />
        ) : null}
          {show("netWorth") ? <MoneyCard label="Net worth" amount={worth} currency={currency} /> : null}
      </div>

      {show("peopleUdhar") ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>People & Udhar</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/people">View all</Link>
              </Button>
              <Button size="sm" onClick={() => openQuickAdd("udhar")}>
                + Add Udhar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">They owe you</p>
                <CurrencyDisplay amount={peopleTotals.theyOwe} currency={currency} className="text-lg font-semibold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">You owe</p>
                <CurrencyDisplay amount={peopleTotals.youOwe} currency={currency} className="text-lg font-semibold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <CurrencyDisplay amount={Math.abs(peopleTotals.net)} currency={currency} className="text-lg font-semibold" />
                <p className="text-[11px] text-muted-foreground">
                  {peopleTotals.net === 0 ? "Even" : peopleTotals.net > 0 ? "They owe you more" : "You owe more"}
                </p>
              </div>
            </div>
            {peopleBalances(people, udhars, udharRepayments)
              .filter((row) => row.balance.theyOwe > 0 || row.balance.youOwe > 0)
              .sort((a, b) => Math.abs(b.balance.net) - Math.abs(a.balance.net))
              .slice(0, 5)
              .map(({ person, balance }) => (
                <Link key={person.id} href={`/people/${person.id}`} className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{person.name}</p>
                  <p className="text-sm tabular-nums">
                    {balance.net >= 0 ? (
                      <CurrencyDisplay amount={balance.theyOwe || balance.net} currency={currency} className="text-sm" />
                    ) : (
                      <CurrencyDisplay amount={balance.youOwe} currency={currency} className="text-sm" />
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">{balance.net >= 0 ? "→" : "←"}</span>
                  </p>
                </Link>
              ))}
            {liveUdhars(udhars, udharRepayments).some((item) => isOpenUdhar(item) && item.dueDate) ? (
              <div className="space-y-2 border-t pt-3">
                {liveUdhars(udhars, udharRepayments)
                  .filter((item) => isOpenUdhar(item) && item.dueDate)
                  .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
                  .slice(0, 4)
                  .map((item) => {
                    const name = people.find((row) => row.id === item.personId)?.name ?? "Someone";
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm">{name}</p>
                          <p className="text-xs text-muted-foreground">{dueLabel(item.dueDate)}</p>
                        </div>
                        <CurrencyDisplay amount={item.outstandingAmount} currency={currency} className="text-sm font-medium" />
                      </div>
                    );
                  })}
              </div>
            ) : null}
            {!people.length ? (
              <p className="text-sm text-muted-foreground">Add informal lending and borrowing with people you know.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Income vs expenses</CardTitle>
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  size="xs"
                  variant={rangeId === option.id ? "default" : "ghost"}
                  onClick={() => setRangeId(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={data.series} currency={currency} />
          </CardContent>
        </Card>
        {show("spendingBreakdown") ? (
          <Card>
            <CardHeader>
              <CardTitle>Spending breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {data.spend.length ? (
                <SpendingDonut data={data.spend} currency={currency} />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">No expenses this month</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {show("cashFlow") ? (
          <Card>
            <CardHeader>
              <CardTitle>Cash flow</CardTitle>
            </CardHeader>
            <CardContent>
              <CashFlowChart data={data.series} currency={currency} />
            </CardContent>
          </Card>
        ) : null}
        {show("budgets") ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Budget planner</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/budgets">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.length ? (
                budgets.slice(0, 5).map((budget) => {
                  const spent = budgetSpent(budget, transactions, month);
                  const pct = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
                  const status = budgetStatus(spent, budget.amount);
                  return (
                    <div key={budget.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{budget.name}</span>
                        <span className="text-muted-foreground">{Math.round(pct)}%</span>
                      </div>
                      <Progress
                        value={pct}
                        className={status === "over" ? "*:data-[slot=progress-indicator]:bg-destructive" : undefined}
                      />
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No budgets yet.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {show("recentTransactions") ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent transactions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/transactions">See all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {transactions.length ? (
                transactions.slice(0, 8).map((tx) => (
                  <TransactionItem key={tx.id} transaction={tx} accounts={accounts} categories={categories} />
                ))
              ) : (
                <EmptyState
                  icon={Wallet}
                  title="No transactions yet"
                  description="Add your first income or expense to see activity here."
                  actionLabel="Quick add"
                  onAction={() => openQuickAdd("expense")}
                  className="border-0 py-10"
                />
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-4">
          {show("upcomingBills") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Upcoming bills</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/bills">All</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {bills.filter((bill) => billStatus(bill) !== "paid").length ? (
                  bills
                    .filter((bill) => billStatus(bill) !== "paid")
                    .slice(0, 4)
                    .map((bill) => {
                      const days = daysUntil(bill.dueDate);
                      const status = billStatus(bill);
                      return (
                        <div key={bill.id} className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{bill.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {days < 0 ? "Overdue" : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`}
                            </p>
                          </div>
                          <div className="text-right">
                            <CurrencyDisplay amount={bill.amount} currency={currency} className="text-sm font-medium" />
                            <Badge variant={status === "overdue" ? "destructive" : "secondary"} className="mt-1">
                              {status.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming bills.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {show("dailyCheck") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Today&apos;s activities</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/daily-check">View</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {checkRows.length ? (
                  <>
                    {checkRows.slice(0, 5).map((row) => (
                      <div key={row.activity.id} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{row.activity.name}</p>
                          <CheckStatusBadge status={row.status} />
                        </div>
                        <CurrencyDisplay amount={row.amount} currency={currency} className="text-sm font-medium" />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {checkStats.completed} / {checkStats.total} completed
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No activities expected today.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {show("pendingSettlements") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Pending settlements</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/daily-check">Pay</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {dueSettlements.length ? (
                  dueSettlements.slice(0, 4).map(({ activity, snap }) => (
                    <div key={activity.id} className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {activity.name}
                        {activity.status === "archived" ? " (ended)" : ""}
                      </p>
                      <CurrencyDisplay amount={snap.due} currency={currency} className="text-sm font-medium" />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No service payments due.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {show("notes") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Notes</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/notes">View all notes</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleReminders(notes).slice(0, 2).map((note) => (
                  <Link key={`reminder-${note.id}`} href={`/notes/${note.id}`} className="block">
                    <p className="text-sm font-medium">{note.title} reminder</p>
                    <p className="text-xs text-muted-foreground">Due now</p>
                  </Link>
                ))}
                {notes.filter((item) => !item.isDeleted && !item.isArchived).length ? (
                  notes
                    .filter((item) => !item.isDeleted && !item.isArchived)
                    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt))
                    .slice(0, 3)
                    .map((note) => (
                      <Link key={note.id} href={`/notes/${note.id}`} className="block">
                        <p className="text-sm font-medium">{note.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{previewText(note.content, 80)}</p>
                      </Link>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {show("goals") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Goals</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/goals">All</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {goals.length ? (
                  goals.slice(0, 3).map((goal) => {
                    const progress = goalProgress(goal);
                    return (
                      <div key={goal.id} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span>{goal.name}</span>
                          <span className="text-muted-foreground">{Math.round(progress.percent)}%</span>
                        </div>
                        <Progress value={progress.percent} />
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">Set a savings goal to get started.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {show("creditCards") ? (
            <Card>
              <CardHeader>
                <CardTitle>Credit cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cards.length ? (
                  cards.map((card) => (
                    <div key={card.id} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span>{card.name}</span>
                        <span>{creditUtilization(card).toFixed(0)}% used</span>
                      </div>
                      <Progress value={creditUtilization(card)} />
                      <p className="text-xs text-muted-foreground">
                        Available{" "}
                        <CurrencyDisplay amount={availableCredit(card)} currency={currency} className="text-xs" />
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No credit cards yet.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {data.insights.length ? (
            <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.insights.map((insight) => (
              <div key={insight.id} className="rounded-md bg-muted/60 p-4">
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{insight.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
