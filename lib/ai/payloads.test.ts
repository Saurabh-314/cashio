import { describe, expect, it } from "vitest";
import { calculateActivityAmount } from "@/lib/finance/activity-calculations";
import { reportExpenseAmount, reportIncomeAmount } from "@/lib/finance/calculations";
import type { Transaction } from "@/types";
import {
  dailyActivityInput,
  dailyActivityTotals,
  expenseTransactionInput,
  incomeTransactionInput,
  sampleRepaymentTransaction,
  sampleUdharTransaction,
  transferTransactionInput,
} from "@/lib/ai/payloads";

describe("AI financial safety", () => {
  it("does not treat transfers as income or expense", () => {
    const transfer = {
      ...transferTransactionInput({
        amount: 5000,
        date: "2026-08-27",
        fromAccountId: "hdfc",
        toAccountId: "cash",
        description: "Transfer",
      }),
      id: "t1",
      createdAt: "",
      updatedAt: "",
      attachments: [],
    } as const;
    expect(reportIncomeAmount(transfer as unknown as Transaction)).toBe(0);
    expect(reportExpenseAmount(transfer as unknown as Transaction)).toBe(0);
  });

  it("does not treat lending as an expense", () => {
    const lent = sampleUdharTransaction({
      type: "lent",
      amount: 5000,
      date: "2026-08-27",
      accountId: "hdfc",
      personName: "Rahul",
    });
    expect(reportExpenseAmount(lent as never)).toBe(0);
    expect(reportIncomeAmount(lent as never)).toBe(0);
  });

  it("does not treat borrowing as income", () => {
    const borrowed = sampleUdharTransaction({
      type: "borrowed",
      amount: 3000,
      date: "2026-08-27",
      accountId: "hdfc",
      personName: "Sumit",
    });
    expect(reportIncomeAmount(borrowed as never)).toBe(0);
    expect(reportExpenseAmount(borrowed as never)).toBe(0);
  });

  it("does not treat principal repayment as income or expense", () => {
    const received = sampleRepaymentTransaction({
      received: true,
      amount: 2000,
      principalAmount: 2000,
      interestAmount: 0,
    });
    const made = sampleRepaymentTransaction({
      received: false,
      amount: 3000,
      principalAmount: 3000,
      interestAmount: 0,
    });
    expect(reportIncomeAmount(received as never)).toBe(0);
    expect(reportExpenseAmount(received as never)).toBe(0);
    expect(reportIncomeAmount(made as never)).toBe(0);
    expect(reportExpenseAmount(made as never)).toBe(0);
  });

  it("treats interest received as income and interest paid as expense", () => {
    const received = sampleRepaymentTransaction({
      received: true,
      amount: 2100,
      principalAmount: 2000,
      interestAmount: 100,
    });
    const made = sampleRepaymentTransaction({
      received: false,
      amount: 3100,
      principalAmount: 3000,
      interestAmount: 100,
    });
    expect(reportIncomeAmount(received as never)).toBe(100);
    expect(reportExpenseAmount(made as never)).toBe(100);
  });

  it("keeps Daily Check unit price separate from the daily total", () => {
    const totals = dailyActivityTotals(60, 2);
    expect(totals.unitPrice).toBe(60);
    expect(totals.quantity).toBe(2);
    expect(totals.dailyTotal).toBe(120);
    expect(calculateActivityAmount({ unitPrice: 60, quantity: 2 })).toBe(120);

    const activity = dailyActivityInput({
      name: "Milk",
      unitPrice: 60,
      quantity: 2,
      unit: "liter",
      startDate: "2026-08-28",
    });
    expect(activity.amount).toBe(60);
    expect(activity.defaultQuantity).toBe(2);
    expect(activity.amount).not.toBe(120);
  });

  it("maps grocery spend and salary to the correct transaction types", () => {
    expect(expenseTransactionInput({
      amount: 500,
      date: "2026-08-27",
      categoryId: "groceries",
      accountId: "hdfc",
      description: "Groceries",
    }).type).toBe("expense");
    expect(incomeTransactionInput({
      amount: 45000,
      date: "2026-08-27",
      categoryId: "salary",
      accountId: "hdfc",
      description: "Salary",
    }).type).toBe("income");
  });
});
