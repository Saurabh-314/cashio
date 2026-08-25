export const CURRENCY_CODES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
  "JPY",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DATE_FORMATS = [
  "dd MMM yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

export type ThemePreference = "light" | "dark" | "system";

export type AccountKind = "bank" | "cash" | "credit" | "investment" | "other_asset";

export type BankAccountType = "savings" | "current" | "salary" | "other";

export type TransactionType = "income" | "expense" | "transfer" | "udhar";

export type UdharKind = "lent" | "borrowed" | "repayment_received" | "repayment_made";

export type CategoryKind = "income" | "expense";

export type BillFrequency = "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type LoanType =
  | "personal"
  | "home"
  | "car"
  | "education"
  | "credit_card"
  | "borrowed"
  | "lent"
  | "other";

export type InvestmentType =
  | "stocks"
  | "mutual_funds"
  | "crypto"
  | "gold"
  | "fd"
  | "other";

export type BudgetScope = "overall" | "category" | "account";

export type PaymentMethod =
  | "upi"
  | "card"
  | "netbanking"
  | "cash"
  | "cheque"
  | "auto_debit"
  | "other";

export type TransactionStatus = "cleared" | "pending";

export type BillStatus = "upcoming" | "due_today" | "overdue" | "paid";

export interface DashboardWidgets {
  totalBalance: boolean;
  income: boolean;
  expenses: boolean;
  savings: boolean;
  netWorth: boolean;
  cashFlow: boolean;
  spendingBreakdown: boolean;
  budgets: boolean;
  goals: boolean;
  upcomingBills: boolean;
  recentTransactions: boolean;
  loans: boolean;
  creditCards: boolean;
  dailyCheck: boolean;
  pendingSettlements: boolean;
  peopleUdhar: boolean;
}

export interface NotificationPrefs {
  bills: boolean;
  budgets: boolean;
  goals: boolean;
  recurring: boolean;
  dailyCheck: boolean;
  settlements: boolean;
  udhar: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  currency: CurrencyCode;
  dateFormat: DateFormat;
  monthStartDay: number;
  defaultAccountId: string | null;
  onboardingCompleted: boolean;
  theme: ThemePreference;
  widgets: DashboardWidgets;
  notifications: NotificationPrefs;
  reminderTime?: string;
  udharReminderDays?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  bankName?: string;
  bankAccountType?: BankAccountType;
  last4?: string;
  openingBalance: number;
  openingOutstanding: number;
  currentBalance: number;
  outstanding: number;
  currency: CurrencyCode;
  color: string;
  icon: string;
  notes?: string;
  archived: boolean;
  creditLimit?: number;
  billingDay?: number;
  paymentDueDay?: number;
  interestRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  icon: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  path: string;
  contentType: string;
  size: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  date: string;
  description: string;
  notes?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  tags: string[];
  attachments: Attachment[];
  recurringId?: string;
  goalId?: string;
  loanId?: string;
  activityId?: string;
  settlementId?: string;
  udharId?: string;
  personId?: string;
  repaymentId?: string;
  udharKind?: UdharKind;
  principalAmount?: number;
  interestAmount?: number;
  isCreditCardPayment: boolean;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  scope: BudgetScope;
  categoryId?: string;
  accountId?: string;
  amount: number;
  month: string;
  rollover: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  accountId?: string;
  description?: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  name: string;
  lender: string;
  loanType: LoanType;
  principalAmount: number;
  remainingAmount: number;
  interestRate: number;
  emi: number;
  startDate: string;
  endDate: string;
  paymentDueDay: number;
  accountId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  name: string;
  categoryId?: string;
  amount: number;
  dueDate: string;
  accountId?: string;
  frequency: BillFrequency;
  reminderDays: number;
  autoRecurring: boolean;
  notes?: string;
  lastPaidDate?: string;
  lastPaidTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId?: string;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  description: string;
  startDate: string;
  endDate?: string;
  frequency: RecurringFrequency;
  autoCreate: boolean;
  lastRunDate?: string;
  nextRunDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  investedAmount: number;
  currentValue: number;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "success";
}

export type QuickAddKind = "expense" | "income" | "transfer" | "bill" | "goal" | "activity" | "udhar";

export type PersonRelationship =
  | "friend"
  | "family"
  | "colleague"
  | "neighbor"
  | "customer"
  | "vendor"
  | "other";

export type UdharType = "lent" | "borrowed";

export type UdharInterestType = "none" | "fixed" | "percentage";

export type UdharStatus = "active" | "partially_paid" | "overdue" | "settled" | "cancelled";

export type UdharPaymentMethod = "cash" | "bank" | "upi" | "card" | "other";

export interface Person {
  id: string;
  name: string;
  phone?: string;
  relationship?: PersonRelationship;
  notes?: string;
  avatarUrl?: string;
  avatarPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Udhar {
  id: string;
  personId: string;
  type: UdharType;
  principalAmount: number;
  outstandingPrincipal: number;
  interestType: UdharInterestType;
  interestRate?: number;
  interestAmount: number;
  outstandingInterest: number;
  totalAmount: number;
  outstandingAmount: number;
  date: string;
  dueDate?: string | null;
  status: UdharStatus;
  accountId: string;
  notes?: string;
  reminderDays?: number;
  remindInDailyCheck?: boolean;
  followUpDoneOn?: string;
  attachments: Attachment[];
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UdharRepayment {
  id: string;
  udharId: string;
  personId: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  accountId: string;
  paymentDate: string;
  paymentMethod: UdharPaymentMethod;
  notes?: string;
  attachments: Attachment[];
  transactionId?: string;
  isNetOffset?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonNote {
  id: string;
  personId: string;
  udharId?: string;
  repaymentId?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityPricingType = "daily" | "weekly" | "monthly" | "per_visit" | "per_unit" | "custom";

export type ActivityFrequency =
  | "daily"
  | "weekdays"
  | "weekends"
  | "specific_days"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "custom";

export type ActivityLifecycle = "active" | "paused" | "archived";

export type ActivityCheckStatus = "completed" | "skipped" | "cancelled" | "pending" | "not_applicable" | "missed";

export type ActivityGroup =
  | "household"
  | "food_delivery"
  | "utilities"
  | "health"
  | "education"
  | "personal"
  | "other";

export type ProviderPayMethod = "cash" | "upi" | "bank" | "other";

export type PauseReason = "vacation" | "provider_holiday" | "personal_holiday" | "service_unavailable" | "custom";

export type SkipReason = "didnt_need" | "provider_unavailable" | "holiday" | "other";

export type SettlementStatus = "unpaid" | "partially_paid" | "paid" | "overdue";

export interface ActivityPause {
  startDate: string;
  endDate: string;
  reason: PauseReason;
  notes?: string;
}

export interface Activity {
  id: string;
  name: string;
  group: ActivityGroup;
  categoryId?: string;
  expenseCategoryId?: string;
  providerId?: string;
  icon: string;
  color: string;
  description?: string;
  providerName?: string;
  providerPhone?: string;
  providerNotes?: string;
  pricingType: ActivityPricingType;
  amount: number;
  unit?: string;
  defaultQuantity: number;
  frequency: ActivityFrequency;
  activeDays: number[];
  startDate: string;
  endDate?: string;
  status: ActivityLifecycle;
  pauses: ActivityPause[];
  autoCreateExpense: boolean;
  autoSettle: boolean;
  defaultAccountId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityRecord {
  id: string;
  activityId: string;
  date: string;
  status: Exclude<ActivityCheckStatus, "pending" | "missed">;
  quantity: number;
  calculatedAmount: number;
  skipReason?: SkipReason;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  paymentPreference: ProviderPayMethod;
  createdAt: string;
  updatedAt: string;
}

export interface ActivitySettlement {
  id: string;
  activityId: string;
  providerId?: string;
  month: string;
  expectedDays: number;
  completedDays: number;
  skippedDays: number;
  missedDays: number;
  amount: number;
  paidAmount: number;
  status: SettlementStatus;
  transactionIds: string[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}
