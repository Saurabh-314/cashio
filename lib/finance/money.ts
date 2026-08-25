import { CURRENCIES } from "@/constants/currencies";
import type { CurrencyCode } from "@/types";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode = "INR",
  options?: { signed?: boolean; compact?: boolean },
): string {
  const cfg = CURRENCIES[currency];
  const abs = Math.abs(amount);
  const fractionDigits = Number.isInteger(roundMoney(abs)) ? 0 : 2;

  const formatted = new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.code,
    maximumFractionDigits: options?.compact ? 0 : fractionDigits,
    minimumFractionDigits: options?.compact ? 0 : fractionDigits,
  }).format(abs);

  if (amount < 0) return `-${formatted}`;
  if (options?.signed && amount > 0) return `+${formatted}`;
  return formatted;
}

export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return roundMoney(value);
}
