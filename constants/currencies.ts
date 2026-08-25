import type { CurrencyCode, DateFormat } from "@/types";

export const CURRENCIES: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; locale: string; name: string }
> = {
  INR: { code: "INR", symbol: "₹", locale: "en-IN", name: "Indian Rupee" },
  USD: { code: "USD", symbol: "$", locale: "en-US", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", locale: "en-GB", name: "British Pound" },
  AED: { code: "AED", symbol: "د.إ", locale: "en-AE", name: "UAE Dirham" },
  SGD: { code: "SGD", symbol: "S$", locale: "en-SG", name: "Singapore Dollar" },
  AUD: { code: "AUD", symbol: "A$", locale: "en-AU", name: "Australian Dollar" },
  CAD: { code: "CAD", symbol: "C$", locale: "en-CA", name: "Canadian Dollar" },
  JPY: { code: "JPY", symbol: "¥", locale: "ja-JP", name: "Japanese Yen" },
};

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  "dd MMM yyyy": "25 Aug 2026",
  "dd/MM/yyyy": "25/08/2026",
  "MM/dd/yyyy": "08/25/2026",
  "yyyy-MM-dd": "2026-08-25",
};
