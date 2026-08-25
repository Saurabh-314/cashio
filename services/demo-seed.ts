import { addMonths, format } from "date-fns";
import { createAccount } from "@/services/users";
import { createTransaction } from "@/services/transactions";
import type { Account, Category } from "@/types";

export async function seedDemoData(uid: string, accounts: Account[], categories: Category[]) {
  let bank = accounts.find((item) => item.kind === "bank");
  if (!bank) {
    const id = await createAccount(uid, {
      name: "Demo Savings",
      kind: "bank",
      bankName: "HDFC",
      bankAccountType: "savings",
      last4: "4291",
      openingBalance: 120000,
      openingOutstanding: 0,
      currency: "INR",
      color: "#3D9B74",
      icon: "wallet",
    });
    bank = { id } as Account;
  }

  const salary = categories.find((item) => item.name === "Salary");
  const food = categories.find((item) => item.name === "Food" || item.name === "Groceries");
  const rent = categories.find((item) => item.name === "Rent");
  const today = new Date();

  const samples = [
    { type: "income" as const, amount: 80000, description: "Salary", categoryId: salary?.id, offset: -3 },
    { type: "expense" as const, amount: 18000, description: "Rent", categoryId: rent?.id, offset: -2 },
    { type: "expense" as const, amount: 4200, description: "Groceries", categoryId: food?.id, offset: -8 },
    { type: "expense" as const, amount: 899, description: "Internet", categoryId: food?.id, offset: -5 },
  ];

  for (const sample of samples) {
    const date = format(addMonths(today, 0), "yyyy-MM-dd").replace(
      /\d{2}$/,
      String(Math.max(1, today.getDate() + sample.offset)).padStart(2, "0"),
    );
    await createTransaction(uid, accounts.length ? accounts : [{ ...bank, kind: "bank", currentBalance: 120000, outstanding: 0, openingBalance: 120000, openingOutstanding: 0, archived: false, currency: "INR", color: "#3D9B74", icon: "wallet", name: "Demo Savings", createdAt: "", updatedAt: "" } as Account], {
      type: sample.type,
      amount: sample.amount,
      date,
      description: sample.description,
      categoryId: sample.categoryId ?? null,
      accountId: bank.id,
      fromAccountId: null,
      toAccountId: null,
      tags: ["demo"],
      attachments: [],
      isCreditCardPayment: false,
      status: "cleared",
    });
  }
}
