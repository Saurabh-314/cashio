"use client";

import { Paperclip } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Account, Category, Transaction } from "@/types";

export function TransactionItem({
  transaction,
  accounts,
  categories,
  onClick,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  onClick?: () => void;
}) {
  const { profile } = useAuth();
  const category = categories.find((item) => item.id === transaction.categoryId);
  const account = accounts.find(
    (item) =>
      item.id === transaction.accountId ||
      item.id === transaction.fromAccountId ||
      item.id === transaction.toAccountId,
  );
  const to = accounts.find((item) => item.id === transaction.toAccountId);
  const amountTone =
    transaction.type === "income" ? "income" : transaction.type === "expense" ? "expense" : "neutral";
  const signedAmount =
    transaction.type === "expense" ? -transaction.amount : transaction.type === "income" ? transaction.amount : transaction.amount;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-200 hover:bg-muted/70"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{transaction.description}</p>
          {transaction.attachments?.length ? <Paperclip className="size-3 text-muted-foreground" /> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {transaction.type === "transfer"
            ? `${account?.name ?? "From"} → ${to?.name ?? "To"}`
            : [category?.name, account?.name].filter(Boolean).join(" · ")}
          {" · "}
          {formatDate(transaction.date, profile?.dateFormat)}
        </p>
      </div>
      <CurrencyDisplay
        amount={signedAmount}
        currency={profile?.currency ?? "INR"}
        signed={transaction.type !== "transfer"}
        tone={amountTone}
        className={cn("text-sm font-medium", transaction.type === "transfer" && "text-muted-foreground")}
      />
    </button>
  );
}
