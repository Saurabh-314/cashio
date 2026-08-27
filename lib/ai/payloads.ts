import { calculateActivityAmount } from "@/lib/finance/activity-calculations";
import { roundMoney } from "@/lib/finance/money";
import type { TransactionInput } from "@/services/transactions";
import type { Activity, Transaction, UdharKind, UdharType } from "@/types";

export function expenseTransactionInput(input: {
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string;
  description: string;
  notes?: string;
}): TransactionInput {
  return {
    type: "expense",
    amount: roundMoney(input.amount),
    date: input.date,
    categoryId: input.categoryId,
    accountId: input.accountId,
    fromAccountId: null,
    toAccountId: null,
    description: input.description,
    notes: input.notes,
    tags: ["ai"],
    attachments: [],
    isCreditCardPayment: false,
    status: "cleared",
  };
}

export function incomeTransactionInput(input: {
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string;
  description: string;
  notes?: string;
}): TransactionInput {
  return {
    type: "income",
    amount: roundMoney(input.amount),
    date: input.date,
    categoryId: input.categoryId,
    accountId: input.accountId,
    fromAccountId: null,
    toAccountId: null,
    description: input.description,
    notes: input.notes,
    tags: ["ai"],
    attachments: [],
    isCreditCardPayment: false,
    status: "cleared",
  };
}

export function transferTransactionInput(input: {
  amount: number;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  description: string;
}): TransactionInput {
  return {
    type: "transfer",
    amount: roundMoney(input.amount),
    date: input.date,
    categoryId: null,
    accountId: null,
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    description: input.description,
    tags: ["ai"],
    attachments: [],
    isCreditCardPayment: false,
    status: "cleared",
  };
}

export function udharKindForType(type: UdharType): Extract<UdharKind, "lent" | "borrowed"> {
  return type === "lent" ? "lent" : "borrowed";
}

export function sampleUdharTransaction(input: {
  type: UdharType;
  amount: number;
  date: string;
  accountId: string;
  personName: string;
}): Pick<Transaction, "type" | "amount" | "udharId" | "udharKind" | "repaymentId" | "interestAmount" | "principalAmount"> {
  return {
    type: "udhar",
    amount: roundMoney(input.amount),
    udharId: "pending",
    udharKind: udharKindForType(input.type),
    repaymentId: undefined,
    interestAmount: 0,
    principalAmount: roundMoney(input.amount),
  };
}

export function sampleRepaymentTransaction(input: {
  received: boolean;
  amount: number;
  principalAmount: number;
  interestAmount: number;
}): Pick<Transaction, "type" | "amount" | "udharId" | "udharKind" | "repaymentId" | "interestAmount" | "principalAmount"> {
  return {
    type: "udhar",
    amount: roundMoney(input.amount),
    udharId: "pending",
    udharKind: input.received ? "repayment_received" : "repayment_made",
    repaymentId: "pending",
    interestAmount: roundMoney(input.interestAmount),
    principalAmount: roundMoney(input.principalAmount),
  };
}

export function dailyActivityInput(input: {
  name: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  startDate: string;
  frequency?: Activity["frequency"];
  categoryId?: string;
}): Omit<Activity, "id" | "createdAt" | "updatedAt"> {
  const unitPrice = roundMoney(input.unitPrice);
  const quantity = input.quantity > 0 ? input.quantity : 1;
  return {
    name: input.name.trim() || "Activity",
    group: "food_delivery",
    icon: "droplets",
    color: "#5B8FA8",
    pricingType: "per_unit",
    amount: unitPrice,
    unit: input.unit || "unit",
    defaultQuantity: quantity,
    frequency: input.frequency ?? "daily",
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    startDate: input.startDate,
    status: "active",
    pauses: [],
    autoCreateExpense: false,
    autoSettle: false,
    expenseCategoryId: input.categoryId,
    notes: undefined,
  };
}

export function dailyActivityTotals(unitPrice: number, quantity: number) {
  return {
    unitPrice: roundMoney(unitPrice),
    quantity,
    dailyTotal: calculateActivityAmount({ unitPrice, quantity }),
  };
}
