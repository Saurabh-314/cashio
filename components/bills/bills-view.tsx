"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLabel } from "@/lib/finance/account-label";
import { billStatus, isAssetAccount } from "@/lib/finance/calculations";
import { emiBillStatus, type CreditEmiBill } from "@/lib/finance/credit-emi";
import {
  listCreditStatements,
  statementStatus,
  type CreditStatement,
} from "@/lib/finance/credit-statements";
import { formatMoney } from "@/lib/finance/money";
import { daysUntil, formatDate, todayISO } from "@/lib/utils/dates";
import { billSchema, type BillValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";
import { EntityNotes } from "@/components/notes/entity-notes";
import type { BillStatus, DateFormat } from "@/types";

function dueText(days: number) {
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  return `Due in ${days} days`;
}

function statusVariant(status: BillStatus): "destructive" | "secondary" | "outline" {
  if (status === "overdue") return "destructive";
  if (status === "paid") return "secondary";
  return "outline";
}

export function BillsView() {
  const { profile } = useAuth();
  const {
    bills,
    accounts,
    saveBill,
    removeBill,
    markBillPaid,
    creditStatements,
    unbilledCredit,
    payCreditStatement,
    creditEmiBills,
    payCreditEmi,
  } = useFinance();
  const [open, setOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creditPay, setCreditPay] = useState<CreditStatement | null>(null);
  const [emiPay, setEmiPay] = useState<CreditEmiBill | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [fromAccountId, setFromAccountId] = useState("");
  const currency = profile?.currency ?? "INR";
  const dateFormat: DateFormat = profile?.dateFormat ?? "dd MMM yyyy";
  const statements = listCreditStatements(creditStatements);
  const payFromAccounts = accounts.filter((item) => !item.archived && isAssetAccount(item));
  const form = useForm<BillValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      dueDate: todayISO(),
      frequency: "monthly",
      reminderDays: 3,
      autoRecurring: false,
    },
  });

  const rows = [
    ...bills.map((bill) => ({ kind: "bill" as const, bill, dueDate: bill.dueDate, paid: billStatus(bill) === "paid" })),
    ...statements.map((statement) => ({
      kind: "statement" as const,
      statement,
      dueDate: statement.dueDate,
      paid: statement.remaining <= 0,
    })),
    ...creditEmiBills.map((bill) => ({
      kind: "emi" as const,
      bill,
      dueDate: bill.dueDate,
      paid: bill.remaining <= 0,
    })),
  ].sort((a, b) => Number(a.paid) - Number(b.paid) || a.dueDate.localeCompare(b.dueDate));


  function openCreditPay(statement: CreditStatement) {
    setCreditPay(statement);
    setPayAmount(statement.remaining);
    const preferred = payFromAccounts.find((item) => item.id === profile?.defaultAccountId) ?? payFromAccounts[0];
    setFromAccountId(preferred?.id ?? "");
  }

  return (
    <div>
      <PageHeader title="Bills" description="Upcoming, due, and overdue payments">
        <Button onClick={() => setOpen(true)}>Add bill</Button>
      </PageHeader>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => {
            if (row.kind === "bill") {
              const bill = row.bill;
              const status = billStatus(bill);
              const days = daysUntil(bill.dueDate);
              return (
                <Card key={bill.id} className="rounded-lg">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">{dueText(days)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CurrencyDisplay amount={bill.amount} currency={currency} className="font-medium" />
                      <Badge variant={statusVariant(status)}>{status.replace("_", " ")}</Badge>
                      {status !== "paid" ? (
                        <Button size="sm" onClick={() => setPayId(bill.id)}>
                          Mark paid
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(bill.id)}>
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                  <div className="px-5 pb-4">
                    <EntityNotes
                      type="bill"
                      entityId={bill.id}
                      entityName={bill.name}
                      inlineNote={bill.notes}
                      compact
                      onSaveInline={async (value) => {
                        await saveBill({ ...bill, notes: value }, bill.id);
                      }}
                    />
                  </div>
                </Card>
              );
            }

            if (row.kind === "emi") {
              const bill = row.bill;
              const status = emiBillStatus(bill);
              const days = daysUntil(bill.dueDate);
              const oldest =
                creditEmiBills
                  .filter((item) => item.emiId === bill.emiId && item.remaining > 0)
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.id === bill.id;
              return (
                <Card key={bill.id} className="rounded-lg">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.accountName}
                        {status === "paid" ? "" : ` · ${dueText(days)}`}
                        {bill.interestAmount > 0
                          ? ` · ${formatMoney(bill.principalAmount, currency)} principal + ${formatMoney(bill.interestAmount, currency)} interest`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        The rest of this purchase stays on the card limit. This row is only this month&apos;s installment.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CurrencyDisplay
                        amount={status === "paid" ? bill.amount : bill.remaining}
                        currency={currency}
                        className="font-medium"
                      />
                      <Badge variant={statusVariant(status)}>{status.replace("_", " ")}</Badge>
                      {status !== "paid" && oldest ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEmiPay(bill);
                            setPayAmount(bill.remaining);
                            const preferred =
                              payFromAccounts.find((item) => item.id === profile?.defaultAccountId) ?? payFromAccounts[0];
                            setFromAccountId(preferred?.id ?? "");
                          }}
                        >
                          Pay EMI
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            const statement = row.statement;
            const status = statementStatus(statement);
            const days = daysUntil(statement.dueDate);
            const cycle =
              statement.cycleStart && statement.cycleEnd
                ? `${formatDate(statement.cycleStart, dateFormat)} – ${formatDate(statement.cycleEnd, dateFormat)}`
                : "Balance already on the card";
            return (
              <Card key={statement.id} className="rounded-lg">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{statement.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cycle}
                      {status === "paid" ? "" : ` · ${dueText(days)}`}
                    </p>
                    {statement.paidAmount > 0 && statement.remaining > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(statement.paidAmount, currency)} paid of {formatMoney(statement.amount, currency)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <CurrencyDisplay
                      amount={status === "paid" ? statement.amount : statement.remaining}
                      currency={currency}
                      className="font-medium"
                    />
                    <Badge variant={statusVariant(status)}>{status.replace("_", " ")}</Badge>
                    {status !== "paid" ? (
                      <Button size="sm" onClick={() => openCreditPay(statement)}>
                        Repay
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : unbilledCredit.length ? null : (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="Track rent, internet, subscriptions, and credit card statements."
          actionLabel="Add bill"
          onAction={() => setOpen(true)}
        />
      )}

      {unbilledCredit.length ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-medium">Not billed yet</h2>
          {unbilledCredit.map((item) => (
            <Card key={item.accountId} className="rounded-lg">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.accountName}</p>
                  <p className="text-xs text-muted-foreground">
                    Statement on {formatDate(item.statementDate, dateFormat)}. These spends are not due until then.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <CurrencyDisplay amount={item.amount} currency={currency} className="font-medium" />
                  <Badge variant="outline">Unbilled</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New bill</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveBill({ ...values, autoRecurring: Boolean(values.autoRecurring) });
                toast.success("Bill added");
                setOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Name">
              <Input {...form.register("name")} placeholder="Internet" />
            </Field>
            <Field label="Amount">
              <MoneyInput currency={currency} value={form.watch("amount")} onChange={(value) => form.setValue("amount", value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" {...form.register("dueDate")} />
            </Field>
            <Field label="Frequency">
              <Select
                value={form.watch("frequency")}
                onValueChange={(value) => form.setValue("frequency", value as BillValues["frequency"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["once", "monthly", "quarterly", "yearly"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button className="w-full" type="submit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payId)} onOpenChange={(openState) => !openState && setPayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay from account</DialogTitle>
          </DialogHeader>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {accountLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={async () => {
              if (payId && accountId) {
                await markBillPaid(payId, accountId);
                toast.success("Marked as paid");
              }
              setPayId(null);
            }}
          >
            Confirm
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(emiPay)} onOpenChange={(openState) => !openState && setEmiPay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay {emiPay?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Principal moves from your bank to the card and reduces the blocked limit. Interest, if any, is recorded as
            an expense.
          </p>
          <Field label="Amount">
            <MoneyInput currency={currency} value={payAmount} onChange={setPayAmount} />
          </Field>
          <Field label="Pay from">
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {payFromAccounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {accountLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            disabled={!fromAccountId || payAmount <= 0}
            onClick={async () => {
              if (!emiPay || !fromAccountId) return;
              try {
                await payCreditEmi(emiPay.emiId, fromAccountId, payAmount);
                toast.success("EMI payment recorded");
                setEmiPay(null);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            Confirm EMI payment
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(creditPay)} onOpenChange={(openState) => !openState && setCreditPay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repay {creditPay?.accountName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This transfers money from your bank or cash to the card and settles this statement. The original card spend
            stays an expense, so it is not counted twice. Spends on the card after this payment show as the next amount
            due.
          </p>
          <Field label="Amount">
            <MoneyInput currency={currency} value={payAmount} onChange={setPayAmount} />
          </Field>
          <p className="text-xs text-muted-foreground">
            Up to {formatMoney(creditPay?.remaining ?? 0, currency)} on this statement.
          </p>
          <Field label="Pay from">
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {payFromAccounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {accountLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            disabled={!fromAccountId || payAmount <= 0 || !payFromAccounts.length}
            onClick={async () => {
              if (!creditPay || !fromAccountId) return;
              try {
                await payCreditStatement(creditPay.accountId, fromAccountId, payAmount, creditPay.id);
                toast.success("Card payment recorded");
                setCreditPay(null);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            Confirm repayment
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete bill?"
        description="Upcoming reminders for this bill will be removed."
        onConfirm={async () => {
          if (deleteId) await removeBill(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
