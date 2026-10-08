import { describe, expect, it } from "vitest";
import { accountBalance, accountLabel, accountLast4 } from "@/lib/finance/account-label";

describe("accountLabel", () => {
  it("shows the last 4 digits for bank and credit accounts", () => {
    expect(accountLabel({ name: "HDFC Savings", kind: "bank", last4: "4291" })).toBe("HDFC Savings •••• 4291");
    expect(accountLabel({ name: "Regalia", kind: "credit", last4: "12-34" })).toBe("Regalia •••• 1234");
  });

  it("keeps cash and other accounts as a name only", () => {
    expect(accountLabel({ name: "Wallet", kind: "cash", last4: "9999" })).toBe("Wallet");
    expect(accountLast4({ kind: "cash", last4: "9999" })).toBeNull();
  });

  it("omits a short or missing number", () => {
    expect(accountLabel({ name: "Axis", kind: "bank", last4: "12" })).toBe("Axis");
    expect(accountLabel({ name: "Axis", kind: "credit" })).toBe("Axis");
  });

  it("uses cash balance for bank and cash, and outstanding for credit", () => {
    expect(accountBalance({ kind: "bank", currentBalance: 1500, outstanding: 0 })).toBe(1500);
    expect(accountBalance({ kind: "cash", currentBalance: 400, outstanding: 0 })).toBe(400);
    expect(accountBalance({ kind: "credit", currentBalance: 0, outstanding: 3200 })).toBe(3200);
  });
});
