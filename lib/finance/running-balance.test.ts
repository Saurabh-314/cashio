import { describe, expect, it } from "vitest";
import { displayedTransactionBalance, transactionBalanceAfter } from "@/lib/finance/calculations";
import type { Account, Transaction } from "@/types";

function account(patch: Partial<Account> & Pick<Account, "id" | "kind">): Account {
  return {
    name: "Account",
    openingBalance: 0,
    openingOutstanding: 0,
    currentBalance: 0,
    outstanding: 0,
    currency: "INR",
    color: "#000",
    icon: "bank",
    archived: false,
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
    description: "Test",
    tags: [],
    attachments: [],
    isCreditCardPayment: false,
    status: "cleared",
    createdAt: patch.date,
    updatedAt: patch.date,
    ...patch,
  };
}

describe("transactionBalanceAfter", () => {
  it("shows the account balance after each transaction, newest first", () => {
    const bank = account({ id: "bank", kind: "bank", currentBalance: 1500 });
    const older = tx({ id: "in", type: "income", amount: 2000, date: "2026-03-01", accountId: "bank", createdAt: "2026-03-01T01:00:00.000Z" });
    const newer = tx({ id: "out", type: "expense", amount: 500, date: "2026-03-02", accountId: "bank", createdAt: "2026-03-02T01:00:00.000Z" });
    const balances = transactionBalanceAfter([bank], [newer, older]);

    expect(displayedTransactionBalance(newer, balances)).toBe(1500);
    expect(displayedTransactionBalance(older, balances)).toBe(2000);
  });

  it("keeps same-day order by created time", () => {
    const bank = account({ id: "bank", kind: "bank", currentBalance: 700 });
    const first = tx({ id: "a", type: "expense", amount: 100, date: "2026-04-01", accountId: "bank", createdAt: "2026-04-01T01:00:00.000Z" });
    const second = tx({ id: "b", type: "expense", amount: 200, date: "2026-04-01", accountId: "bank", createdAt: "2026-04-01T02:00:00.000Z" });
    const balances = transactionBalanceAfter([bank], [first, second]);

    expect(displayedTransactionBalance(second, balances)).toBe(700);
    expect(displayedTransactionBalance(first, balances)).toBe(900);
  });

  it("uses the filtered account on a transfer", () => {
    const from = account({ id: "from", kind: "bank", name: "Savings", currentBalance: 1000 });
    const to = account({ id: "to", kind: "cash", name: "Wallet", currentBalance: 800 });
    const transfer = tx({
      id: "t",
      type: "transfer",
      amount: 200,
      date: "2026-05-01",
      fromAccountId: "from",
      toAccountId: "to",
    });
    const balances = transactionBalanceAfter([from, to], [transfer]);

    expect(displayedTransactionBalance(transfer, balances)).toBe(1000);
    expect(displayedTransactionBalance(transfer, balances, "to")).toBe(800);
  });

  it("uses outstanding as the balance on a credit card", () => {
    const card = account({ id: "card", kind: "credit", outstanding: 3000 });
    const spend = tx({ id: "e", type: "expense", amount: 1000, date: "2026-06-02", accountId: "card" });
    const payment = tx({
      id: "p",
      type: "transfer",
      amount: 500,
      date: "2026-06-01",
      fromAccountId: "bank",
      toAccountId: "card",
    });
    const bank = account({ id: "bank", kind: "bank", currentBalance: 4500 });
    const balances = transactionBalanceAfter([card, bank], [spend, payment]);

    expect(displayedTransactionBalance(spend, balances, "card")).toBe(3000);
    expect(displayedTransactionBalance(payment, balances, "card")).toBe(2000);
  });
});
