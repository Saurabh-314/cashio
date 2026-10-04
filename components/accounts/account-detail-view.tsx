"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLast4 } from "@/lib/finance/account-label";
import {
  availableCredit,
  creditUtilization,
  displayedTransactionBalance,
  periodTotals,
  transactionBalanceAfter,
} from "@/lib/finance/calculations";
import { unpaidStatementTotal, type CreditStatement, type UnbilledCredit } from "@/lib/finance/credit-statements";
import { formatDate, monthRange } from "@/lib/utils/dates";
import { ConvertEmiDialog } from "@/components/accounts/convert-emi-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EntityNotes } from "@/components/notes/entity-notes";
import { formatMoney } from "@/lib/finance/money";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/firebase/errors";
import type { CurrencyCode, DateFormat } from "@/types";

export function AccountDetailView({ accountId }: { accountId: string }) {
  const { profile } = useAuth();
  const { accounts, transactions, categories, saveAccount, creditStatements, unbilledCredit, creditEmis, removeCreditEmi } =
    useFinance();
  const [emiOpen, setEmiOpen] = useState(false);
  const [emiSession, setEmiSession] = useState(0);
  const [cancelEmiId, setCancelEmiId] = useState<string | null>(null);
  const account = accounts.find((item) => item.id === accountId);
  const currency = profile?.currency ?? "INR";

  const related = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.accountId === accountId || tx.fromAccountId === accountId || tx.toAccountId === accountId,
      ),
    [accountId, transactions],
  );
  const balances = useMemo(() => transactionBalanceAfter(accounts, transactions), [accounts, transactions]);
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
  const last4 = accountLast4(account);

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/accounts">
          <ArrowLeft /> Back
        </Link>
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">
            {account.kind} account
            {last4 ? ` · •••• ${last4}` : ""}
          </p>
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
            <CreditStatementSummary
              accountId={account.id}
              currency={currency}
              dateFormat={profile?.dateFormat ?? "dd MMM yyyy"}
              statements={creditStatements}
              unbilled={unbilledCredit}
            />
            <div className="space-y-3 border-t border-border pt-3">
              {creditEmis
                .filter((item) => item.accountId === account.id && item.remainingPrincipal > 0)
                .map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(item.monthlyAmount, currency)} / month ·{" "}
                        {formatMoney(item.remainingPrincipal, currency)} still blocking the limit
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setCancelEmiId(item.id)}>
                      Cancel
                    </Button>
                  </div>
                ))}
              <Button
                variant="outline"
                onClick={() => {
                  setEmiSession((value) => value + 1);
                  setEmiOpen(true);
                }}
                disabled={account.outstanding <= 0}
              >
                Convert to EMI
              </Button>
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
              <TransactionItem
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                categories={categories}
                balance={displayedTransactionBalance(tx, balances, account.id)}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No transactions on this account yet.</p>
          )}
        </CardContent>
      </Card>
      <ConvertEmiDialog key={emiSession} account={account} open={emiOpen} onOpenChange={setEmiOpen} />
      <ConfirmDialog
        open={Boolean(cancelEmiId)}
        onOpenChange={(open) => !open && setCancelEmiId(null)}
        title="Cancel this EMI?"
        description="The converted spends go back onto the card statement. Installments you already paid stay on the card as payments."
        confirmLabel="Cancel EMI"
        onConfirm={async () => {
          if (!cancelEmiId) return;
          try {
            await removeCreditEmi(cancelEmiId);
            toast.success("EMI cancelled");
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
          setCancelEmiId(null);
        }}
      />
    </div>
  );
}

function CreditStatementSummary({
  accountId,
  currency,
  dateFormat,
  statements,
  unbilled,
}: {
  accountId: string;
  currency: CurrencyCode;
  dateFormat: DateFormat;
  statements: CreditStatement[];
  unbilled: UnbilledCredit[];
}) {
  const due = unpaidStatementTotal(statements, accountId);
  const open = unbilled.find((item) => item.accountId === accountId);
  if (due <= 0 && !open) return null;

  return (
    <div className="space-y-2 border-t border-border pt-3 text-sm">
      {due > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <span>Statement due</span>
          <span className="flex items-center gap-3">
            <CurrencyDisplay amount={due} currency={currency} />
            <Button size="sm" variant="outline" asChild>
              <Link href="/bills">Repay</Link>
            </Button>
          </span>
        </div>
      ) : null}
      {open ? (
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Unbilled until {formatDate(open.statementDate, dateFormat)}</span>
          <CurrencyDisplay amount={open.amount} currency={currency} />
        </div>
      ) : null}
    </div>
  );
}
