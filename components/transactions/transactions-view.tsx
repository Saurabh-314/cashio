"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { CategorySelect } from "@/components/forms/category-select";
import { TransactionForm } from "@/components/forms/transaction-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/firebase/errors";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  displayedTransactionBalance,
  isUdharTransaction,
  signedTransactionAmount,
  transactionAmountTone,
  transactionBalanceAfter,
  transactionTypeLabel,
} from "@/lib/finance/calculations";
import { EntityNotes } from "@/components/notes/entity-notes";
import type { Transaction, TransactionType } from "@/types";

export function TransactionsView() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { transactions, accounts, categories, removeTransaction, saveTransaction, openQuickAdd } = useFinance();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState<TransactionType | "all">("all");
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const balances = useMemo(() => transactionBalanceAfter(accounts, transactions), [accounts, transactions]);
  const balanceFor = (tx: Transaction) =>
    displayedTransactionBalance(tx, balances, accountId === "all" ? undefined : accountId);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const next = transactions.filter((tx) => {
      if (type === "udhar") {
        if (!isUdharTransaction(tx)) return false;
      } else if (type !== "all") {
        if (isUdharTransaction(tx) || tx.type !== type) return false;
      }
      if (accountId !== "all" && tx.accountId !== accountId && tx.fromAccountId !== accountId && tx.toAccountId !== accountId)
        return false;
      if (categoryId !== "all" && tx.categoryId !== categoryId) return false;
      if (!query) return true;
      const category = categories.find((item) => item.id === tx.categoryId)?.name ?? "";
      const account = accountLabel(accounts.find((item) => item.id === (tx.accountId ?? tx.fromAccountId)));
      return [tx.description, tx.merchant, tx.notes, category, account, String(tx.amount)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    next.sort((a, b) => {
      if (sort === "oldest") return a.date.localeCompare(b.date);
      if (sort === "high") return b.amount - a.amount;
      if (sort === "low") return a.amount - b.amount;
      return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    });
    return next;
  }, [accountId, accounts, categories, categoryId, q, sort, transactions, type]);

  const filters = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <Select
        value={type}
        onValueChange={(value) => {
          const next = value as typeof type;
          setType(next);
          if (next === "expense" || next === "income") {
            const selected = categories.find((item) => item.id === categoryId);
            if (selected && selected.kind !== next) setCategoryId("all");
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="transfer">Transfer</SelectItem>
          <SelectItem value="udhar">People & Udhar</SelectItem>
        </SelectContent>
      </Select>
      <Select value={accountId} onValueChange={setAccountId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Account" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {accountLabel(account)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <CategorySelect
        categories={
          type === "expense" || type === "income"
            ? categories.filter((item) => item.kind === type)
            : categories
        }
        value={categoryId}
        onChange={setCategoryId}
        placeholder="Category"
        allowAll
      />
      <Select value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="high">Highest amount</SelectItem>
          <SelectItem value="low">Lowest amount</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <PageHeader title="Transactions" description="Income, expenses, transfers, and People & Udhar">
        <Button variant="outline" className="md:hidden" onClick={() => setFiltersOpen(true)}>
          Filters
        </Button>
        <Button onClick={() => openQuickAdd("expense")}>Add transaction</Button>
      </PageHeader>
      <div className="mb-4 flex flex-col gap-3">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search description, merchant, category…"
          className="h-10 rounded-xl"
        />
        <div className="hidden md:block">{filters}</div>
      </div>
      {filtered.length ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => {
                  const category = categories.find((item) => item.id === tx.categoryId);
                  const account = accounts.find(
                    (item) => item.id === tx.accountId || item.id === tx.fromAccountId,
                  );
                  const signed = signedTransactionAmount(tx);
                  const tone = transactionAmountTone(tx);
                  return (
                    <TableRow
                      key={tx.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelected(tx);
                        setEditing(false);
                      }}
                    >
                      <TableCell className="text-muted-foreground">
                        {formatDate(tx.date, profile?.dateFormat)}
                      </TableCell>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {isUdharTransaction(tx) ? "People & Udhar" : category?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{accountLabel(account, "—")}</TableCell>
                      <TableCell className="text-muted-foreground">{transactionTypeLabel(tx)}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay
                          amount={signed}
                          currency={profile?.currency ?? "INR"}
                          signed={tx.type !== "transfer"}
                          tone={tone}
                          className="text-sm font-medium"
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {balanceFor(tx) == null ? (
                          "—"
                        ) : (
                          <CurrencyDisplay
                            amount={balanceFor(tx) ?? 0}
                            currency={profile?.currency ?? "INR"}
                            className="text-sm"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tx.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y rounded-lg border bg-card md:hidden">
            {filtered.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                categories={categories}
                balance={balanceFor(tx)}
                onClick={() => {
                  setSelected(tx);
                  setEditing(false);
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={ArrowLeftRight}
          title="No transactions yet"
          description="Add your first income, expense, or transfer."
          actionLabel="Add transaction"
          onAction={() => openQuickAdd("expense")}
        />
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">{filters}</div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit transaction" : "Transaction"}</SheetTitle>
          </SheetHeader>
          {selected && !editing ? (
            <div className="space-y-4 px-4 pb-6">
              <CurrencyDisplay
                amount={signedTransactionAmount(selected)}
                currency={profile?.currency ?? "INR"}
                signed={selected.type !== "transfer"}
                tone={transactionAmountTone(selected)}
                className="text-3xl font-semibold"
              />
              <dl className="space-y-2 text-sm">
                <Row label="Type" value={transactionTypeLabel(selected)} />
                <Row label="Date" value={formatDate(selected.date, profile?.dateFormat)} />
                <Row
                  label="Category"
                  value={
                    isUdharTransaction(selected)
                      ? "People & Udhar"
                      : categories.find((item) => item.id === selected.categoryId)?.name ?? "—"
                  }
                />
                <Row
                  label="Account"
                  value={
                    selected.type === "transfer"
                      ? `${accountLabel(accounts.find((item) => item.id === selected.fromAccountId), "—")} → ${accountLabel(accounts.find((item) => item.id === selected.toAccountId), "—")}`
                      : accountLabel(accounts.find((item) => item.id === selected.accountId), "—")
                  }
                />
                <Row
                  label="Balance"
                  value={
                    balanceFor(selected) == null
                      ? "—"
                      : formatMoney(balanceFor(selected) ?? 0, profile?.currency ?? "INR")
                  }
                />
                <Row label="Merchant" value={selected.merchant || "—"} />
                <Row label="Created" value={formatDate(selected.createdAt.slice(0, 10), profile?.dateFormat)} />
              </dl>
              <EntityNotes
                type="transaction"
                entityId={selected.id}
                entityName={selected.description}
                inlineNote={selected.notes}
                compact
                onSaveInline={async (value) => {
                  await saveTransaction({ ...selected, notes: value }, selected.id);
                  setSelected({ ...selected, notes: value });
                  toast.success("Note saved");
                }}
              />
              {isUdharTransaction(selected) ? (
                <p className="text-sm text-muted-foreground">
                  This only moved money between you and a person. It is not income or expense
                  {selected.interestAmount ? ", except the interest portion." : "."} Manage it from the person page.
                </p>
              ) : null}
              {selected.attachments?.length ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Attachments</p>
                  {selected.attachments.map((file) => (
                    <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="block text-sm underline">
                      {file.name}
                    </a>
                  ))}
                </div>
              ) : null}
              {selected.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {isUdharTransaction(selected) ? (
                  <Button variant="outline" asChild>
                    <a href={selected.personId ? `/people/${selected.personId}` : "/people"}>Open in People & Udhar</a>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setEditing(true)}>
                      <Pencil /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await saveTransaction({ ...selected, description: `${selected.description} (copy)` });
                          toast.success("Duplicated");
                          setSelected(null);
                        } catch (error) {
                          toast.error(getErrorMessage(error));
                        }
                      }}
                    >
                      <Copy /> Duplicate
                    </Button>
                    <Button variant="destructive" onClick={() => setConfirm(true)}>
                      <Trash2 /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : selected ? (
            <div className="px-4 pb-6">
              <TransactionForm
                initial={selected}
                onDone={() => {
                  setEditing(false);
                  setSelected(null);
                  toast.success("Updated");
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete transaction?"
        description="This will reverse its effect on account balances."
        onConfirm={async () => {
          if (!selected) return;
          try {
            await removeTransaction(selected.id);
            toast.success("Deleted");
            setSelected(null);
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
