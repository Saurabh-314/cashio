"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Copy, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TransactionItem } from "@/components/transactions/transaction-item";
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
import { formatDate } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/firebase/errors";
import { CurrencyDisplay } from "@/components/shared/currency-display";
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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const next = transactions.filter((tx) => {
      if (type !== "all" && tx.type !== type) return false;
      if (accountId !== "all" && tx.accountId !== accountId && tx.fromAccountId !== accountId && tx.toAccountId !== accountId)
        return false;
      if (categoryId !== "all" && tx.categoryId !== categoryId) return false;
      if (!query) return true;
      const category = categories.find((item) => item.id === tx.categoryId)?.name ?? "";
      const account = accounts.find((item) => item.id === (tx.accountId ?? tx.fromAccountId))?.name ?? "";
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
      <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="transfer">Transfer</SelectItem>
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
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <PageHeader title="Transactions" description="Income, expenses, and transfers">
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => {
                  const category = categories.find((item) => item.id === tx.categoryId);
                  const account = accounts.find(
                    (item) => item.id === tx.accountId || item.id === tx.fromAccountId,
                  );
                  const signed = tx.type === "expense" ? -tx.amount : tx.amount;
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
                      <TableCell className="text-muted-foreground">{category?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{account?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{tx.type}</TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay
                          amount={signed}
                          currency={profile?.currency ?? "INR"}
                          signed={tx.type !== "transfer"}
                          tone={tx.type === "expense" ? "expense" : tx.type === "income" ? "income" : "neutral"}
                          className="text-sm font-medium"
                        />
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
                amount={selected.type === "expense" ? -selected.amount : selected.amount}
                currency={profile?.currency ?? "INR"}
                signed
                tone={selected.type === "expense" ? "expense" : selected.type === "income" ? "income" : "neutral"}
                className="text-3xl font-semibold"
              />
              <dl className="space-y-2 text-sm">
                <Row label="Type" value={selected.type} />
                <Row label="Date" value={formatDate(selected.date, profile?.dateFormat)} />
                <Row label="Category" value={categories.find((item) => item.id === selected.categoryId)?.name ?? "—"} />
                <Row
                  label="Account"
                  value={
                    selected.type === "transfer"
                      ? `${accounts.find((item) => item.id === selected.fromAccountId)?.name} → ${accounts.find((item) => item.id === selected.toAccountId)?.name}`
                      : accounts.find((item) => item.id === selected.accountId)?.name ?? "—"
                  }
                />
                <Row label="Merchant" value={selected.merchant || "—"} />
                <Row label="Notes" value={selected.notes || "—"} />
                <Row label="Created" value={formatDate(selected.createdAt.slice(0, 10), profile?.dateFormat)} />
              </dl>
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
