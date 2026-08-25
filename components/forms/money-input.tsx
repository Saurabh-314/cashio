"use client";

import { Input } from "@/components/ui/input";
import { CURRENCIES } from "@/constants/currencies";
import { parseAmount } from "@/lib/finance/money";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types";

export function MoneyInput({
  value,
  onChange,
  currency = "INR",
  className,
  id,
}: {
  value: number | string;
  onChange: (value: number) => void;
  currency?: CurrencyCode;
  className?: string;
  id?: string;
}) {
  const symbol = CURRENCIES[currency].symbol;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        {symbol}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        className={cn("pl-7", className)}
        value={value === 0 || value === "0" ? "" : String(value)}
        onChange={(event) => onChange(parseAmount(event.target.value))}
        placeholder="0"
      />
    </div>
  );
}
