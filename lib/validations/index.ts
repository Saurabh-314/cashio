import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const accountSchema = z.object({
  name: z.string().min(2, "Enter an account name"),
  kind: z.enum(["bank", "cash", "credit", "investment", "other_asset"]),
  bankName: z.string().optional(),
  bankAccountType: z.enum(["savings", "current", "salary", "other"]).optional(),
  last4: z.string().max(4).optional(),
  openingBalance: z.number(),
  openingOutstanding: z.number().optional(),
  creditLimit: z.number().optional(),
  billingDay: z.number().min(1).max(31).optional(),
  paymentDueDay: z.number().min(1).max(31).optional(),
  interestRate: z.number().min(0).optional(),
  color: z.string().min(1),
  icon: z.string().min(1),
  notes: z.string().optional(),
});

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive("Enter an amount"),
    date: z.string().min(1, "Choose a date"),
    description: z.string().min(1, "Add a description"),
    notes: z.string().optional(),
    merchant: z.string().optional(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
    paymentMethod: z
      .enum(["upi", "card", "netbanking", "cash", "cheque", "auto_debit", "other"])
      .optional(),
    tags: z.string().optional(),
    loanId: z.string().optional(),
    principalAmount: z.number().optional(),
    interestAmount: z.number().optional(),
    goalId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "transfer") {
      if (!value.fromAccountId) {
        ctx.addIssue({ code: "custom", message: "Choose a source account", path: ["fromAccountId"] });
      }
      if (!value.toAccountId) {
        ctx.addIssue({ code: "custom", message: "Choose a destination account", path: ["toAccountId"] });
      }
      if (value.fromAccountId && value.fromAccountId === value.toAccountId) {
        ctx.addIssue({
          code: "custom",
          message: "Choose two different accounts",
          path: ["toAccountId"],
        });
      }
    } else if (!value.accountId) {
      ctx.addIssue({ code: "custom", message: "Choose an account", path: ["accountId"] });
    }
  });

export const categorySchema = z.object({
  name: z.string().min(1, "Enter a name"),
  kind: z.enum(["income", "expense"]),
  parentId: z.string().nullable().optional(),
  icon: z.string().min(1),
  color: z.string().min(1),
});

export const budgetSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  scope: z.enum(["overall", "category", "account"]),
  amount: z.number().positive("Enter a budget amount"),
  month: z.string().min(1),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  rollover: z.boolean().optional(),
});

export const goalSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  targetAmount: z.number().positive("Enter a target"),
  currentAmount: z.number().min(0),
  targetDate: z.string().min(1),
  accountId: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().min(1),
  color: z.string().min(1),
});

export const loanSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  lender: z.string().min(1, "Enter a lender"),
  loanType: z.enum([
    "personal",
    "home",
    "car",
    "education",
    "credit_card",
    "borrowed",
    "lent",
    "other",
  ]),
  principalAmount: z.number().positive(),
  remainingAmount: z.number().min(0),
  interestRate: z.number().min(0),
  emi: z.number().min(0),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  paymentDueDay: z.number().min(1).max(31),
  accountId: z.string().optional(),
  notes: z.string().optional(),
});

export const billSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  frequency: z.enum(["once", "daily", "weekly", "monthly", "quarterly", "yearly"]),
  reminderDays: z.number().min(0).max(30),
  autoRecurring: z.boolean().optional(),
  notes: z.string().optional(),
});

export const recurringSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive(),
  description: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  autoCreate: z.boolean().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
});

export const investmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["stocks", "mutual_funds", "crypto", "gold", "fd", "other"]),
  investedAmount: z.number().min(0),
  currentValue: z.number().min(0),
  date: z.string().min(1),
  notes: z.string().optional(),
});

export const activitySchema = z.object({
  name: z.string().min(1, "Enter an activity name"),
  group: z.enum(["household", "food_delivery", "utilities", "health", "education", "personal", "other"]),
  icon: z.string().min(1),
  color: z.string().min(1),
  description: z.string().optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  providerPhone: z.string().optional(),
  providerNotes: z.string().optional(),
  pricingType: z.enum(["daily", "weekly", "monthly", "per_visit", "per_unit", "custom"]),
  amount: z.number().positive("Enter an amount"),
  unit: z.string().optional(),
  defaultQuantity: z.number().min(0),
  frequency: z.enum([
    "daily",
    "weekdays",
    "weekends",
    "specific_days",
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
    "custom",
  ]),
  activeDays: z.array(z.number().min(0).max(6)).optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  expenseCategoryId: z.string().optional(),
  defaultAccountId: z.string().optional(),
  autoCreateExpense: z.boolean().optional(),
  autoSettle: z.boolean().optional(),
  notes: z.string().optional(),
});

export const providerSchema = z.object({
  name: z.string().min(1, "Enter a provider name"),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  paymentPreference: z.enum(["cash", "upi", "bank", "other"]),
});

export const pauseSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.enum(["vacation", "provider_holiday", "personal_holiday", "service_unavailable", "custom"]),
  notes: z.string().optional(),
});

export const profileSchema = z.object({
  displayName: z.string().min(2),
});

export const csvRowSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(["income", "expense", "transfer"]),
  category: z.string().optional(),
  account: z.string().optional(),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type AccountValues = z.infer<typeof accountSchema>;
export type TransactionValues = z.infer<typeof transactionSchema>;
export type CategoryValues = z.infer<typeof categorySchema>;
export type BudgetValues = z.infer<typeof budgetSchema>;
export type GoalValues = z.infer<typeof goalSchema>;
export type LoanValues = z.infer<typeof loanSchema>;
export type BillValues = z.infer<typeof billSchema>;
export type RecurringValues = z.infer<typeof recurringSchema>;
export type InvestmentValues = z.infer<typeof investmentSchema>;
export const personSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  phone: z.string().optional(),
  relationship: z
    .enum(["friend", "family", "colleague", "neighbor", "customer", "vendor", "other"])
    .optional(),
  notes: z.string().optional(),
});

export const udharSchema = z
  .object({
    personId: z.string().optional(),
    newPersonName: z.string().optional(),
    newPersonPhone: z.string().optional(),
    newPersonRelationship: z
      .enum(["friend", "family", "colleague", "neighbor", "customer", "vendor", "other"])
      .optional(),
    type: z.enum(["lent", "borrowed"]),
    principalAmount: z.number().positive("Enter an amount"),
    date: z.string().min(1, "Choose a date"),
    dueDate: z.string().optional(),
    noDueDate: z.boolean().optional(),
    accountId: z.string().min(1, "Choose an account"),
    interestType: z.enum(["none", "fixed", "percentage"]),
    interestAmount: z.number().min(0).optional(),
    interestRate: z.number().min(0).optional(),
    notes: z.string().optional(),
    reminderDays: z.number().min(0).max(30).optional(),
    remindInDailyCheck: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if ((!value.personId || value.personId === "__new__") && !value.newPersonName?.trim()) {
      ctx.addIssue({ code: "custom", message: "Choose or add a person", path: ["personId"] });
    }
    if (value.interestType === "fixed" && !(value.interestAmount && value.interestAmount > 0)) {
      ctx.addIssue({ code: "custom", message: "Enter the interest amount", path: ["interestAmount"] });
    }
    if (value.interestType === "percentage" && !(value.interestRate && value.interestRate > 0)) {
      ctx.addIssue({ code: "custom", message: "Enter the interest %", path: ["interestRate"] });
    }
  });

export const repaymentSchema = z.object({
  amount: z.number().positive("Enter an amount"),
  accountId: z.string().min(1, "Choose an account"),
  paymentDate: z.string().min(1, "Choose a date"),
  paymentMethod: z.enum(["cash", "bank", "upi", "card", "other"]),
  notes: z.string().optional(),
  udharId: z.string().optional(),
});

export const personNoteSchema = z.object({
  body: z.string().min(1, "Write a note"),
});

export type ActivityValues = z.infer<typeof activitySchema>;
export type ProviderValues = z.infer<typeof providerSchema>;
export type PauseValues = z.infer<typeof pauseSchema>;
export type PersonValues = z.infer<typeof personSchema>;
export type UdharValues = z.infer<typeof udharSchema>;
export type RepaymentValues = z.infer<typeof repaymentSchema>;
export type PersonNoteValues = z.infer<typeof personNoteSchema>;
