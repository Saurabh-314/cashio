"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLabel } from "@/lib/finance/account-label";
import {
  budgetSpent,
  monthlySeries,
  netWorth,
  periodTotals,
  spendingByCategory,
  totalAssets,
  totalLiabilities,
} from "@/lib/finance/calculations";
import { lastNMonthsRange, monthRange, previousMonthRange, yearRange } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/finance/money";
import { udharMonthlySeries, udharTotals } from "@/lib/finance/udhar";
import { formatQuantityWithUnit, monthSummary, usesQuantity } from "@/lib/finance/activity-calculations";
import { ActivityUnitPriceText } from "@/components/daily-check/activity-pricing";

const IncomeExpenseChart = dynamic(
  () => import("@/components/charts/finance-charts").then((mod) => mod.IncomeExpenseChart),
  { ssr: false },
);
const CashFlowChart = dynamic(
  () => import("@/components/charts/finance-charts").then((mod) => mod.CashFlowChart),
  { ssr: false },
);
const SpendingDonut = dynamic(
  () => import("@/components/charts/finance-charts").then((mod) => mod.SpendingDonut),
  { ssr: false },
);

const PRESETS = [
  { id: "this", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom" },
] as const;

export function ReportsView() {
  const { profile } = useAuth();
  const { transactions, categories, accounts, budgets, investments, loans, udhars, udharRepayments, activities, activityRecords } = useFinance();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("this");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const currency = profile?.currency ?? "INR";

  const range = useMemo(() => {
    if (preset === "this") return monthRange();
    if (preset === "last") return previousMonthRange();
    if (preset === "3m") return lastNMonthsRange(3);
    if (preset === "6m") return lastNMonthsRange(6);
    if (preset === "year") return yearRange();
    return { start: customStart || monthRange().start, end: customEnd || monthRange().end };
  }, [customEnd, customStart, preset]);

  const totals = periodTotals(transactions, range.start, range.end);
  const series = monthlySeries(transactions, range.start, range.end);
  const spend = spendingByCategory(transactions, range.start, range.end).map((item, index) => {
    const category = categories.find((cat) => cat.id === item.categoryId);
    const palette = ["#1F2937", "#2F6B4F", "#7C6F5B", "#B84A4A", "#B7791F", "#737373"];
    return { name: category?.name ?? "Other", value: item.amount, color: palette[index % palette.length], amount: item.amount };
  });
  const merchants = Object.entries(
    transactions.reduce<Record<string, number>>((acc, tx) => {
      if (tx.type !== "expense" || !tx.merchant) return acc;
      if (tx.date < range.start || tx.date > range.end) return acc;
      acc[tx.merchant] = (acc[tx.merchant] ?? 0) + tx.amount;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const peopleTotals = udharTotals(udhars, udharRepayments);
  const assets = totalAssets(accounts, investments, loans, peopleTotals.theyOwe);
  const liabilities = totalLiabilities(accounts, loans, peopleTotals.youOwe);
  const worth = netWorth(accounts, investments, loans, peopleTotals.theyOwe, peopleTotals.youOwe);
  const peopleSeries = udharMonthlySeries(udhars, udharRepayments, range.start, range.end);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="A clear statement of income, spending, and net worth" />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <Button key={item.id} size="sm" variant={preset === item.id ? "default" : "outline"} onClick={() => setPreset(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
          <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Financial report
        </h2>
        <dl className="mt-6 grid max-w-md gap-3 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Income</dt>
            <dd className="tabular-nums font-medium">{formatMoney(totals.income, currency)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Expenses</dt>
            <dd className="tabular-nums font-medium">{formatMoney(totals.expenses, currency)}</dd>
          </div>
          <div className="flex justify-between gap-8 border-t pt-3">
            <dt className="text-muted-foreground">Savings</dt>
            <dd className="tabular-nums font-medium">{formatMoney(totals.savings, currency)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Savings rate</dt>
            <dd className="tabular-nums font-medium">{totals.savingsRate.toFixed(1)}%</dd>
          </div>
          <div className="flex justify-between gap-8 border-t pt-3">
            <dt className="text-muted-foreground">Net worth</dt>
            <dd className="tabular-nums text-base font-semibold">{formatMoney(worth, currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Income trend</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={series} currency={currency} />
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Cash flow</CardTitle>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={series} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Category breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {spend.length ? <SpendingDonut data={spend} currency={currency} /> : <p className="text-sm text-muted-foreground">No expenses in this range.</p>}
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {merchants.length ? (
              merchants.map(([name, amount]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span>{name}</span>
                  <CurrencyDisplay amount={amount} currency={currency} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No merchant data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Account activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts
              .filter((item) => !item.archived)
              .map((account) => (
                <div key={account.id} className="flex justify-between text-sm">
                  <span>{accountLabel(account)}</span>
                  <CurrencyDisplay
                    amount={account.kind === "credit" ? -account.outstanding : account.currentBalance}
                    currency={currency}
                  />
                </div>
              ))}
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Budget variance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {budgets.length ? (
              budgets.map((budget) => {
                const spent = budgetSpent(budget, transactions, range.start.slice(0, 7));
                return (
                  <div key={budget.id} className="flex justify-between text-sm">
                    <span>{budget.name}</span>
                    <span>
                      {formatMoney(spent, currency)} / {formatMoney(budget.amount, currency)}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No budgets to compare.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Net worth composition</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat label="Assets" amount={assets} currency={currency} />
          <Stat label="Liabilities" amount={liabilities} currency={currency} />
          <Stat label="Net worth" amount={worth} currency={currency} />
        </CardContent>
        <p className="px-5 pb-5 text-xs text-muted-foreground">
          Assets include money people owe you ({formatMoney(peopleTotals.theyOwe, currency)}). Liabilities include money you owe people ({formatMoney(peopleTotals.youOwe, currency)}).
        </p>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>People & Udhar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Total lent</dt>
              <dd className="tabular-nums font-medium">{formatMoney(peopleTotals.totalLent, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Total borrowed</dt>
              <dd className="tabular-nums font-medium">{formatMoney(peopleTotals.totalBorrowed, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">They owe you</dt>
              <dd className="tabular-nums font-medium">{formatMoney(peopleTotals.theyOwe, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">You owe</dt>
              <dd className="tabular-nums font-medium">{formatMoney(peopleTotals.youOwe, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Interest earned</dt>
              <dd className="tabular-nums font-medium">{formatMoney(peopleTotals.interestEarned, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-muted-foreground">Interest paid</dt>
              <dd className="tabular-nums font-medium">{formatMoney(peopleTotals.interestPaid, currency)}</dd>
            </div>
          </dl>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Monthly lent vs borrowed</p>
            {peopleSeries.map((row) => (
              <div key={row.month} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className="text-muted-foreground">
                  lent {formatMoney(row.lent, currency)} · borrowed {formatMoney(row.borrowed, currency)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Daily Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activities.some((activity) => {
            const summary = monthSummary(activity, activityRecords, range.end.slice(0, 7));
            return summary.expectedDays > 0 || summary.amount > 0 || summary.completedDays > 0;
          }) ? (
            activities
              .map((activity) => {
                const summary = monthSummary(activity, activityRecords, range.end.slice(0, 7));
                if (summary.expectedDays <= 0 && summary.amount <= 0 && summary.completedDays <= 0) return null;
                const avgQty = summary.completedDays > 0 ? summary.quantity / summary.completedDays : activity.defaultQuantity;
                return (
                  <div key={activity.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">
                        {activity.name}
                        {activity.status === "archived" ? " (ended)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Unit price <ActivityUnitPriceText activity={activity} currency={currency} className="text-xs" />
                        {usesQuantity(activity) ? (
                          <>
                            {" · "}Average quantity {formatQuantityWithUnit(avgQty, activity.unit)}
                            /day
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{summary.completedDays} completed days</p>
                    </div>
                    <CurrencyDisplay amount={summary.amount} currency={currency} className="text-sm font-medium" />
                  </div>
                );
              })
          ) : (
            <p className="text-sm text-muted-foreground">No Daily Check activities in this range.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, amount, currency }: { label: string; amount: number; currency: "INR" | "USD" | "EUR" | "GBP" | "AED" | "SGD" | "AUD" | "CAD" | "JPY" }) {
  return (
    <Card className="rounded-lg">
      <CardContent>
        <p className="label-kicker">{label}</p>
        <CurrencyDisplay amount={amount} currency={currency} className="mt-2 text-xl font-semibold" />
      </CardContent>
    </Card>
  );
}
