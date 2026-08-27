import { roundMoney } from "@/lib/finance/money";

const CRORE = 1_00_00_000;
const LAKH = 1_00_000;
const THOUSAND = 1_000;

function parseUnit(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "").toLowerCase();
  if (!cleaned) return null;

  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)(cr|crore|lakh|lac|l|k)?$/);
  if (!match) {
    const fallback = Number.parseFloat(cleaned.replace(/[^\d.-]/g, ""));
    return Number.isFinite(fallback) ? roundMoney(fallback) : null;
  }

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2];
  if (unit === "cr" || unit === "crore") return roundMoney(value * CRORE);
  if (unit === "lakh" || unit === "lac" || unit === "l") return roundMoney(value * LAKH);
  if (unit === "k") return roundMoney(value * THOUSAND);
  return roundMoney(value);
}

export function parseMoneyAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? roundMoney(raw) : null;
  }
  if (typeof raw !== "string") return null;
  return parseUnit(raw);
}

export function requirePositiveAmount(raw: string | number | null | undefined): number {
  const amount = parseMoneyAmount(raw);
  if (amount == null || amount <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return amount;
}
