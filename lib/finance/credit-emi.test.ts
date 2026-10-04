import { describe, expect, it } from "vitest";
import { creditCardStatements } from "@/lib/finance/credit-statements";
import {
  absorbEmiPrincipal,
  creditEmiBills,
  emiInstallmentCount,
  splitEmiPayment,
} from "@/lib/finance/credit-emi";
import type { Account, CreditEmi, Transaction } from "@/types";

function account(patch: Partial<Account> & Pick<Account, "id" | "kind">): Account {
  return {
    name: "HDFC",
    openingBalance: 0,
    openingOutstanding: 0,
    currentBalance: 0,
    outstanding: 36000,
    currency: "INR",
    color: "#000",
    icon: "card",
    archived: false,
    billingDay: 5,
    paymentDueDay: 25,
    creditLimit: 65000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

function tx(patch: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amount" | "date">): Transaction {
  return {
    categoryId: null,
    accountId: null,
    fromAccountId: null,
    toAccountId: null,
    description: "Spend",
    tags: [],
    attachments: [],
    isCreditCardPayment: false,
    status: "cleared",
    createdAt: patch.date,
    updatedAt: patch.date,
    ...patch,
  };
}

function emi(patch: Partial<CreditEmi> = {}): CreditEmi {
  return {
    id: "emi1",
    accountId: "card",
    name: "HDFC",
    principalAmount: 36000,
    remainingPrincipal: 36000,
    monthlyAmount: 3000,
    monthlyInterest: 0,
    interestPaid: 0,
    startDate: "2026-04-25",
    absorbed: [{ transactionId: "e1", amount: 36000 }],
    openingAmount: 0,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...patch,
  };
}

const card = account({ id: "card", kind: "credit" });

describe("credit card EMI", () => {
  it("keeps the converted spend off the statement and bills only the monthly EMI", () => {
    const spend = tx({ id: "e1", type: "expense", amount: 36000, date: "2026-03-10", accountId: "card" });
    const plan = emi();
    const view = creditCardStatements([card], [spend], "2026-04-06", [plan]);
    expect(view.statements).toEqual([]);
    expect(view.unbilled).toEqual([]);

    const bills = creditEmiBills([plan], [card], "2026-04-06");
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({
      name: "HDFC EMI",
      dueDate: "2026-04-25",
      amount: 3000,
      remaining: 3000,
      principalAmount: 3000,
    });
    expect(emiInstallmentCount(36000, 3000)).toBe(12);
  });

  it("drops the blocked amount only after an installment is paid", () => {
    const bills = creditEmiBills([emi({ remainingPrincipal: 33000 })], [card], "2026-04-26");
    expect(bills.find((item) => item.remaining > 0)).toMatchObject({ dueDate: "2026-05-25", remaining: 3000 });
  });

  it("splits a payment into principal first, then interest", () => {
    const [bill] = creditEmiBills(
      [emi({ monthlyAmount: 3000, monthlyInterest: 200, principalAmount: 33600, remainingPrincipal: 33600 })],
      [card],
      "2026-04-06",
    );
    expect(bill.principalAmount).toBe(2800);
    expect(bill.interestAmount).toBe(200);
    expect(splitEmiPayment(bill, 3000)).toEqual({ principal: 2800, interest: 200 });
    expect(splitEmiPayment(bill, 1000)).toEqual({ principal: 1000, interest: 0 });
  });

  it("bills only the part of a spend that was not converted", () => {
    const bank = account({ id: "bank", kind: "bank", name: "Savings", outstanding: 0 });
    const spend = tx({ id: "e1", type: "expense", amount: 40000, date: "2026-03-10", accountId: "card" });
    const payment = tx({
      id: "p1",
      type: "transfer",
      amount: 3000,
      date: "2026-04-25",
      fromAccountId: "bank",
      toAccountId: "card",
      emiId: "emi1",
    });
    const view = creditCardStatements(
      [card, bank],
      [spend, payment],
      "2026-04-26",
      [emi()],
    );
    expect(view.statements[0]).toMatchObject({ amount: 4000, remaining: 4000 });
  });

  it("absorbs selected spends before opening outstanding", () => {
    const plan = absorbEmiPrincipal(
      36000,
      [{ id: "e1", date: "2026-03-10", description: "Phone", amount: 36000 }],
      ["e1"],
      0,
    );
    expect(plan).toEqual({ absorbed: [{ transactionId: "e1", amount: 36000 }], openingAmount: 0 });
  });
});
