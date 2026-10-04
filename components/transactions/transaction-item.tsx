"use client";

import { Paperclip } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { useAuth } from "@/hooks/use-auth";
import { accountLabel } from "@/lib/finance/account-label";
import {
  isUdharTransaction,
  signedTransactionAmount,
  transactionAmountTone,
} from "@/lib/finance/calculations";
import { formatDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Account, Category, Transaction } from "@/types";

export function TransactionItem({
  transaction,
  accounts,
  categories,
  balance,
  onClick,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  balance?: number | null;
  onClick?: () => void;
}) {
  const { profile } = useAuth();
  const category = categories.find((item) => item.id === transaction.categoryId);
  const account = accounts.find((item) => item.id === (transaction.accountId ?? transaction.fromAccountId));
  const to = accounts.find((item) => item.id === transaction.toAccountId);
  const isUdhar = isUdharTransaction(transaction);
  const amountTone = transactionAmountTone(transaction);
  const signedAmount = signedTransactionAmount(transaction);
  const subtitle =
    transaction.type === "transfer"
      ? `${accountLabel(account, "From")} → ${accountLabel(to, "To")}`
      : isUdhar
        ? ["People & Udhar", accountLabel(account)].filter(Boolean).join(" · ")
        : [category?.name, accountLabel(account)].filter(Boolean).join(" · ");

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
          {subtitle}
          {" · "}
          {formatDate(transaction.date, profile?.dateFormat)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <CurrencyDisplay
          amount={signedAmount}
          currency={profile?.currency ?? "INR"}
          signed={transaction.type !== "transfer"}
          tone={amountTone}
          className={cn("text-sm font-medium", transaction.type === "transfer" && "text-muted-foreground")}
        />
        {balance != null ? (
          <p className="text-[11px] text-muted-foreground">
            Balance{" "}
            <CurrencyDisplay amount={balance} currency={profile?.currency ?? "INR"} className="text-[11px]" />
          </p>
        ) : null}
      </div>
    </button>
  );
}
