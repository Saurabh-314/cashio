"use client";

import { formatMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types";

export function CurrencyDisplay({
  amount,
  currency,
  signed = false,
  className,
  tone,
}: {
  amount: number;
  currency: CurrencyCode;
  signed?: boolean;
  className?: string;
  tone?: "income" | "expense" | "neutral" | "auto";
}) {
  const resolved =
    tone === "auto" ? (amount > 0 ? "income" : amount < 0 ? "expense" : "neutral") : tone;
  return (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        resolved === "income" && "text-income",
        resolved === "expense" && "text-expense",
        className,
      )}
    >
      {formatMoney(amount, currency, { signed })}
    </span>
  );
}
