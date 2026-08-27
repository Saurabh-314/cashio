import { describe, expect, it } from "vitest";
import {
  getCategorySpending,
  getNetWorthSummary,
  getPeopleSummary,
  getTransactionSummary,
  resolveRange,
} from "@/lib/ai/context";
import type { FinanceSnapshot } from "@/lib/ai/data";
import type { Account, Category, Person, Transaction, Udhar } from "@/types";

function snapshot(patch: Partial<FinanceSnapshot> = {}): FinanceSnapshot {
  const accounts: Account[] = [
    {
      id: "hdfc",
      name: "HDFC Bank",
      kind: "bank",
      openingBalance: 100000,
      openingOutstanding: 0,
      currentBalance: 80000,
      outstanding: 0,
      currency: "INR",
      color: "#000",
      icon: "landmark",
      archived: false,
      createdAt: "",
      updatedAt: "",
    },
  ];
  const categories: Category[] = [
    {
      id: "food",
      name: "Food",
      kind: "expense",
      parentId: null,
      icon: "utensils",
      color: "#000",
      isDefault: true,
      createdAt: "",
      updatedAt: "",
    },
  ];
  const transactions: Transaction[] = [
    {
      id: "e1",
      type: "expense",
      amount: 500,
      categoryId: "food",
      accountId: "hdfc",
      fromAccountId: null,
      toAccountId: null,
      date: "2026-08-10",
      description: "Lunch",
      tags: [],
      attachments: [],
      isCreditCardPayment: false,
      status: "cleared",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "i1",
      type: "income",
      amount: 45000,
      categoryId: null,
      accountId: "hdfc",
      fromAccountId: null,
      toAccountId: null,
      date: "2026-08-01",
      description: "Salary",
      tags: [],
      attachments: [],
      isCreditCardPayment: false,
      status: "cleared",
      createdAt: "",
      updatedAt: "",
    },
  ];
  const people: Person[] = [
    { id: "rahul", name: "Rahul", createdAt: "", updatedAt: "" },
  ];
  const udhars: Udhar[] = [
    {
      id: "u1",
      personId: "rahul",
      type: "lent",
      principalAmount: 5000,
      outstandingPrincipal: 5000,
      interestType: "none",
      interestAmount: 0,
      outstandingInterest: 0,
      totalAmount: 5000,
      outstandingAmount: 5000,
      date: "2026-08-05",
      dueDate: null,
      status: "active",
      accountId: "hdfc",
      attachments: [],
      createdAt: "",
      updatedAt: "",
    },
  ];

  return {
    profile: null,
    meta: {
      today: "2026-08-27",
      timezone: "Asia/Kolkata",
      currency: "INR",
      dateFormat: "dd MMM yyyy",
      monthStartDay: 1,
      displayName: "Test",
    },
    accounts,
    categories,
    transactions,
    budgets: [],
    goals: [],
    loans: [],
    bills: [],
    recurring: [],
    investments: [],
    activities: [],
    activityRecords: [],
    settlements: [],
    people,
    udhars,
    udharRepayments: [],
    ...patch,
  };
}

describe("AI read context", () => {
  it("answers how much was spent this month from real totals", () => {
    const data = snapshot();
    const range = resolveRange(data, "this month");
    const summary = getTransactionSummary(data, range);
    expect(summary.expenses.amount).toBe(500);
    expect(summary.income.amount).toBe(45000);
  });

  it("answers who owes the user from People/Udhar data", () => {
    const people = getPeopleSummary(snapshot());
    expect(people.theyOwe.amount).toBe(5000);
    expect(people.people[0]?.name).toBe("Rahul");
  });

  it("uses existing net worth logic", () => {
    const worth = getNetWorthSummary(snapshot());
    expect(worth.liquid.amount).toBe(80000);
    expect(worth.receivable.amount).toBe(5000);
    expect(worth.netWorth.amount).toBe(85000);
  });

  it("groups category spending without inventing values", () => {
    const data = snapshot();
    const spending = getCategorySpending(data, resolveRange(data, "this month"));
    expect(spending.categories[0]?.category).toBe("Food");
    expect(spending.categories[0]?.amount.amount).toBe(500);
  });
});
