"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { availableCredit, creditUtilization, periodTotals } from "@/lib/finance/calculations";
import { monthRange } from "@/lib/utils/dates";
import { EntityNotes } from "@/components/notes/entity-notes";

export function AccountDetailView({ accountId }: { accountId: string }) {
  const { profile } = useAuth();
  const { accounts, transactions, categories, saveAccount } = useFinance();
  const account = accounts.find((item) => item.id === accountId);
  const currency = profile?.currency ?? "INR";

  const related = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.accountId === accountId || tx.fromAccountId === accountId || tx.toAccountId === accountId,
      ),
    [accountId, transactions],
  );
  const range = monthRange();
  const totals = periodTotals(
    related.map((tx) =>
      tx.type === "transfer"
        ? { ...tx, type: tx.toAccountId === accountId ? "income" : "expense", accountId }
        : tx,
    ),
    range.start,
    range.end,
  );

  if (!account) {
    return (
      <p className="text-sm text-muted-foreground">
        Account not found. <Link href="/accounts">Back to accounts</Link>
      </p>
    );
  }

  const transfers = related.filter((tx) => tx.type === "transfer").length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/accounts">
          <ArrowLeft /> Back
        </Link>
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{account.kind} account</p>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
        </div>
        {account.kind === "credit" ? (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <CurrencyDisplay amount={account.outstanding} currency={currency} className="text-3xl font-semibold" />
          </div>
        ) : (
          <CurrencyDisplay amount={account.currentBalance} currency={currency} className="text-3xl font-semibold" />
        )}
      </div>

      {account.kind === "credit" ? (
        <Card className="rounded-lg">
          <CardContent className="space-y-3 pt-1">
            <div className="flex justify-between text-sm">
              <span>Limit</span>
              <CurrencyDisplay amount={account.creditLimit ?? 0} currency={currency} />
            </div>
            <Progress value={creditUtilization(account)} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Available {availableCredit(account).toLocaleString("en-IN")}</span>
              <span>Due day {account.paymentDueDay ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Income</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={totals.income} currency={currency} tone="income" className="text-xl font-semibold" />
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <CurrencyDisplay amount={totals.expenses} currency={currency} tone="expense" className="text-xl font-semibold" />
            </CardContent>
          </Card>
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{transfers}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <EntityNotes
        type="account"
        entityId={account.id}
        entityName={account.name}
        inlineNote={account.notes}
        onSaveInline={async (value) => {
          await saveAccount(
            {
              name: account.name,
              kind: account.kind,
              bankName: account.bankName,
              bankAccountType: account.bankAccountType,
              last4: account.last4,
              openingBalance: account.openingBalance,
              openingOutstanding: account.openingOutstanding,
              currency: account.currency,
              color: account.color,
              icon: account.icon,
              notes: value,
              creditLimit: account.creditLimit,
              billingDay: account.billingDay,
              paymentDueDay: account.paymentDueDay,
              interestRate: account.interestRate,
            },
            account.id,
          );
        }}
      />

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {related.length ? (
            related.slice(0, 20).map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} accounts={accounts} categories={categories} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No transactions on this account yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
