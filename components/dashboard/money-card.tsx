"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatPercent } from "@/lib/finance/money";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types";

export function MoneyCard({
  label,
  amount,
  currency,
  change,
  hint,
  tone = "neutral",
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  change?: number;
  hint?: string;
  tone?: "income" | "expense" | "neutral";
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3">
        <p className="label-kicker">{label}</p>
        <CurrencyDisplay
          amount={amount}
          currency={currency}
          className="block text-[1.75rem] font-semibold leading-none"
          tone={tone === "neutral" ? undefined : tone}
        />
        {change != null ? (
          <p className={cn("text-xs", positive ? "text-income" : "text-expense")}>
            {formatPercent(change)} from last month
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
