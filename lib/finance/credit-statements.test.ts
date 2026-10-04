import { describe, expect, it } from "vitest";
import { creditCardStatements, listCreditStatements, statementStatus } from "@/lib/finance/credit-statements";
import type { Account, Transaction } from "@/types";

function account(patch: Partial<Account> & Pick<Account, "id" | "kind">): Account {
  return {
    name: "Card",
    openingBalance: 0,
    openingOutstanding: 0,
    currentBalance: 0,
    outstanding: 0,
    currency: "INR",
    color: "#000",
    icon: "card",
    archived: false,
    billingDay: 5,
    paymentDueDay: 25,
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

const card = account({ id: "card", kind: "credit", name: "HDFC" });
const bank = account({ id: "bank", kind: "bank", name: "Savings", billingDay: undefined, paymentDueDay: undefined });

describe("creditCardStatements", () => {
  it("keeps spends unbilled until the billing day", () => {
    const view = creditCardStatements(
      [card, bank],
      [tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" })],
      "2026-04-04",
    );
    expect(view.statements).toEqual([]);
    expect(view.unbilled).toEqual([
      expect.objectContaining({ accountId: "card", amount: 1000, statementDate: "2026-04-05" }),
    ]);
  });

  it("creates a statement the day the cycle closes, due after the billing day", () => {
    const view = creditCardStatements(
      [card],
      [tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" })],
      "2026-04-05",
    );
    expect(view.unbilled).toEqual([]);
    expect(view.statements).toHaveLength(1);
    expect(view.statements[0]).toMatchObject({
      name: "HDFC statement",
      cycleStart: "2026-03-06",
      cycleEnd: "2026-04-05",
      dueDate: "2026-04-25",
      amount: 1000,
      paidAmount: 0,
      remaining: 1000,
    });
    expect(statementStatus(view.statements[0], "2026-04-05")).toBe("upcoming");
  });

  it("puts the due date in the next month when the due day is not after the billing day", () => {
    const view = creditCardStatements(
      [account({ id: "card", kind: "credit", name: "Axis", billingDay: 20, paymentDueDay: 5 })],
      [tx({ id: "e1", type: "expense", amount: 800, date: "2026-03-01", accountId: "card" })],
      "2026-03-20",
    );
    expect(view.statements[0]).toMatchObject({ cycleEnd: "2026-03-20", dueDate: "2026-04-05", amount: 800 });
  });

  it("clamps a 31st billing day to the last day of February", () => {
    const view = creditCardStatements(
      [account({ id: "card", kind: "credit", billingDay: 31, paymentDueDay: 5 })],
      [tx({ id: "e1", type: "expense", amount: 200, date: "2026-02-10", accountId: "card" })],
      "2026-03-01",
    );
    expect(view.statements).toHaveLength(1);
    expect(view.statements[0]).toMatchObject({
      cycleStart: "2026-02-01",
      cycleEnd: "2026-02-28",
      dueDate: "2026-03-05",
      amount: 200,
    });
  });

  it("reduces the statement when the card was already paid during the cycle", () => {
    const view = creditCardStatements(
      [card, bank],
      [
        tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" }),
        tx({
          id: "p1",
          type: "transfer",
          amount: 400,
          date: "2026-03-20",
          fromAccountId: "bank",
          toAccountId: "card",
        }),
      ],
      "2026-04-06",
    );
    expect(view.statements[0]).toMatchObject({ amount: 1000, paidAmount: 400, remaining: 600 });
  });

  it("applies a later payment to the oldest unpaid statement first", () => {
    const view = creditCardStatements(
      [card, bank],
      [
        tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" }),
        tx({ id: "e2", type: "expense", amount: 500, date: "2026-04-10", accountId: "card" }),
        tx({
          id: "p1",
          type: "transfer",
          amount: 1000,
          date: "2026-04-20",
          fromAccountId: "bank",
          toAccountId: "card",
        }),
        tx({
          id: "p2",
          type: "transfer",
          amount: 200,
          date: "2026-05-01",
          fromAccountId: "bank",
          toAccountId: "card",
        }),
      ],
      "2026-05-06",
    );
    expect(view.statements).toHaveLength(2);
    expect(view.statements[0]).toMatchObject({ cycleEnd: "2026-04-05", remaining: 0 });
    expect(view.statements[1]).toMatchObject({ cycleEnd: "2026-05-05", amount: 500, remaining: 300 });
    expect(statementStatus(view.statements[0], "2026-05-06")).toBe("paid");
  });

  it("treats a refund as credit and a cash advance as a charge", () => {
    const view = creditCardStatements(
      [card, bank],
      [
        tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" }),
        tx({ id: "r1", type: "income", amount: 150, date: "2026-03-12", accountId: "card" }),
        tx({
          id: "a1",
          type: "transfer",
          amount: 200,
          date: "2026-03-15",
          fromAccountId: "card",
          toAccountId: "bank",
        }),
      ],
      "2026-04-05",
    );
    expect(view.statements[0]).toMatchObject({ amount: 1200, paidAmount: 150, remaining: 1050 });
  });

  it("pays the opening balance before cycle spends", () => {
    const view = creditCardStatements(
      [account({ id: "card", kind: "credit", name: "HDFC", openingOutstanding: 2000 })],
      [
        tx({ id: "e1", type: "expense", amount: 500, date: "2026-03-10", accountId: "card" }),
        tx({
          id: "p1",
          type: "transfer",
          amount: 2000,
          date: "2026-03-18",
          fromAccountId: "bank",
          toAccountId: "card",
        }),
      ],
      "2026-04-06",
    );
    expect(view.statements[0]).toMatchObject({ name: "HDFC opening balance", remaining: 0 });
    expect(view.statements[1]).toMatchObject({ amount: 500, remaining: 500 });
  });

  it("clears the statement you paid even when an older balance is still unpaid", () => {
    const yes = account({
      id: "card",
      kind: "credit",
      name: "Yes Bank CC",
      billingDay: 1,
      paymentDueDay: 20,
      openingOutstanding: 8000,
    });
    const view = creditCardStatements(
      [yes, bank],
      [
        tx({ id: "e1", type: "expense", amount: 3161, date: "2026-08-15", accountId: "card" }),
        tx({
          id: "p1",
          type: "transfer",
          amount: 3161,
          date: "2026-10-04",
          fromAccountId: "bank",
          toAccountId: "card",
        }),
        tx({ id: "e2", type: "expense", amount: 900, date: "2026-09-20", accountId: "card" }),
        tx({ id: "e3", type: "expense", amount: 250, date: "2026-10-03", accountId: "card" }),
      ],
      "2026-10-04",
    );
    const paid = view.statements.find((item) => item.cycleEnd === "2026-09-01");
    expect(paid).toMatchObject({ cycleStart: "2026-08-02", amount: 3161, remaining: 0 });
    expect(listCreditStatements(view.statements).some((item) => item.cycleEnd === "2026-09-01")).toBe(false);
    expect(listCreditStatements(view.statements).find((item) => item.cycleEnd === "2026-10-01")).toMatchObject({
      cycleStart: "2026-09-02",
      amount: 900,
      remaining: 900,
    });
    expect(view.unbilled).toEqual([
      expect.objectContaining({ accountId: "card", amount: 250, statementDate: "2026-11-01" }),
    ]);
    expect(view.statements.find((item) => item.cycleEnd === null)?.remaining).toBe(8000);
  });

  it("applies a repayment to the statement that was paid, then shows later card spends", () => {
    const yes = account({
      id: "card",
      kind: "credit",
      name: "Yes Bank CC",
      billingDay: 1,
      paymentDueDay: 20,
      openingOutstanding: 8000,
    });
    const statementId = "cc:card:2026-09-01";
    const view = creditCardStatements(
      [yes, bank],
      [
        tx({ id: "old", type: "expense", amount: 4000, date: "2026-07-10", accountId: "card" }),
        tx({ id: "e1", type: "expense", amount: 3161, date: "2026-08-15", accountId: "card" }),
        tx({
          id: "p1",
          type: "transfer",
          amount: 3161,
          date: "2026-10-04",
          fromAccountId: "bank",
          toAccountId: "card",
          statementId,
        }),
        tx({ id: "e2", type: "expense", amount: 700, date: "2026-10-02", accountId: "card" }),
      ],
      "2026-10-04",
    );
    expect(view.statements.find((item) => item.id === statementId)?.remaining).toBe(0);
    expect(listCreditStatements(view.statements).some((item) => item.id === statementId)).toBe(false);
    expect(listCreditStatements(view.statements).find((item) => item.cycleEnd === "2026-08-01")).toMatchObject({
      amount: 4000,
      remaining: 4000,
    });
    expect(view.unbilled).toEqual([expect.objectContaining({ amount: 700, statementDate: "2026-11-01" })]);
  });

  it("hides a credit card statement once it is paid", () => {
    const view = creditCardStatements(
      [card, bank],
      [
        tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" }),
        tx({
          id: "p1",
          type: "transfer",
          amount: 1000,
          date: "2026-04-06",
          fromAccountId: "bank",
          toAccountId: "card",
        }),
      ],
      "2026-04-06",
    );
    expect(view.statements[0]).toMatchObject({ amount: 1000, remaining: 0 });
    expect(listCreditStatements(view.statements)).toEqual([]);
  });

  it("ignores bank expenses and archived cards", () => {
    const view = creditCardStatements(
      [account({ id: "card", kind: "credit", archived: true }), bank],
      [
        tx({ id: "e1", type: "expense", amount: 1000, date: "2026-03-10", accountId: "bank" }),
        tx({ id: "e2", type: "expense", amount: 1000, date: "2026-03-10", accountId: "card" }),
      ],
      "2026-04-06",
    );
    expect(view.statements).toEqual([]);
    expect(view.unbilled).toEqual([]);
  });
});
