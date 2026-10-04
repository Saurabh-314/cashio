import type { Account, AccountKind } from "@/types";

type NamedAccount = Pick<Account, "name"> & Partial<Pick<Account, "kind" | "last4">>;

export function accountLast4(
  account: { kind?: AccountKind; last4?: string } | null | undefined,
): string | null {
  if (!account) return null;
  if (account.kind && account.kind !== "bank" && account.kind !== "credit") return null;
  const digits = (account.last4 ?? "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? digits : null;
}

export function accountLabel(account: NamedAccount | null | undefined, fallback = ""): string {
  if (!account) return fallback;
  const last4 = accountLast4(account);
  return last4 ? `${account.name} •••• ${last4}` : account.name;
}
