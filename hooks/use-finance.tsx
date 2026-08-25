"use client";

import {
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { roundMoney } from "@/lib/finance/money";
import { lastNMonthsRange, todayISO } from "@/lib/utils/dates";
import { useAuth } from "@/hooks/use-auth";
import { col, toIso } from "@/services/helpers";
import {
  applySettlementPayment,
  buildCheckRecord,
  snapshotSettlement,
  settlementId,
  upsertDocAt,
} from "@/services/activities";
import {
  addDocAt,
  createTransaction,
  deleteDocAt,
  deleteTransaction,
  updateDocAt,
  updateTransaction,
  type TransactionInput,
} from "@/services/transactions";
import { createAccount, updateUserProfile } from "@/services/users";
import type {
  Account,
  Activity,
  ActivityCheckStatus,
  ActivityPause,
  ActivityRecord,
  ActivitySettlement,
  Bill,
  Budget,
  Category,
  Goal,
  Investment,
  Loan,
  QuickAddKind,
  RecurringTransaction,
  ServiceProvider,
  SkipReason,
  Transaction,
  UserProfile,
} from "@/types";

interface FinanceContextValue {
  loading: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  loans: Loan[];
  bills: Bill[];
  recurring: RecurringTransaction[];
  investments: Investment[];
  activities: Activity[];
  activityRecords: ActivityRecord[];
  providers: ServiceProvider[];
  settlements: ActivitySettlement[];
  saveAccount: (
    input: Omit<Account, "id" | "createdAt" | "updatedAt" | "currentBalance" | "outstanding" | "archived">,
    id?: string,
  ) => Promise<string>;
  archiveAccount: (id: string) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  saveCategory: (input: Omit<Category, "id" | "createdAt" | "updatedAt" | "isDefault">, id?: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  saveTransaction: (input: TransactionInput, id?: string) => Promise<string>;
  removeTransaction: (id: string) => Promise<void>;
  saveBudget: (input: Omit<Budget, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
  saveGoal: (input: Omit<Goal, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number, fromAccountId?: string) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  saveLoan: (input: Omit<Loan, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<void>;
  payLoan: (loanId: string, principal: number, interest: number, accountId: string, date: string) => Promise<void>;
  removeLoan: (id: string) => Promise<void>;
  saveBill: (input: Omit<Bill, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<void>;
  markBillPaid: (billId: string, accountId: string) => Promise<void>;
  removeBill: (id: string) => Promise<void>;
  saveRecurring: (
    input: Omit<RecurringTransaction, "id" | "createdAt" | "updatedAt">,
    id?: string,
  ) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
  saveInvestment: (input: Omit<Investment, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<void>;
  removeInvestment: (id: string) => Promise<void>;
  saveActivity: (input: Omit<Activity, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<string>;
  removeActivity: (id: string) => Promise<void>;
  saveProvider: (input: Omit<ServiceProvider, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<string>;
  removeProvider: (id: string) => Promise<void>;
  checkIn: (input: {
    activityId: string;
    date?: string;
    status: Exclude<ActivityCheckStatus, "pending" | "missed">;
    quantity?: number;
    skipReason?: SkipReason;
    notes?: string;
  }) => Promise<void>;
  bulkCheckIn: (
    activityIds: string[],
    status: "completed" | "skipped",
    date?: string,
  ) => Promise<void>;
  pauseActivity: (activityId: string, pause: ActivityPause) => Promise<void>;
  resumeActivity: (activityId: string) => Promise<void>;
  paySettlement: (input: {
    activityId: string;
    month: string;
    amount: number;
    accountId: string;
    date: string;
    createExpense?: boolean;
    paymentMethod?: Transaction["paymentMethod"];
  }) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  quickAddOpen: boolean;
  quickAddKind: QuickAddKind;
  openQuickAdd: (kind?: QuickAddKind) => void;
  closeQuickAdd: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function mapDocs<T>(docs: { id: string; data: () => Record<string, unknown> }[]): T[] {
  return docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      ...data,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    } as T;
  });
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(Boolean(uid));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [settlements, setSettlements] = useState<ActivitySettlement[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddKind, setQuickAddKind] = useState<QuickAddKind>("expense");

  useEffect(() => {
    if (!uid) return;

    // Show skeletons until the first snapshot arrives for this user.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscription setup
    setLoading(true);
    const unsubs = [
      onSnapshot(col(uid, "accounts"), (snap) => setAccounts(mapDocs<Account>(snap.docs))),
      onSnapshot(col(uid, "categories"), (snap) => setCategories(mapDocs<Category>(snap.docs))),
      onSnapshot(col(uid, "budgets"), (snap) => setBudgets(mapDocs<Budget>(snap.docs))),
      onSnapshot(col(uid, "goals"), (snap) => setGoals(mapDocs<Goal>(snap.docs))),
      onSnapshot(col(uid, "loans"), (snap) => setLoans(mapDocs<Loan>(snap.docs))),
      onSnapshot(col(uid, "bills"), (snap) => setBills(mapDocs<Bill>(snap.docs))),
      onSnapshot(col(uid, "recurringTransactions"), (snap) =>
        setRecurring(mapDocs<RecurringTransaction>(snap.docs)),
      ),
      onSnapshot(col(uid, "investments"), (snap) => setInvestments(mapDocs<Investment>(snap.docs))),
      onSnapshot(col(uid, "activities"), (snap) => setActivities(mapDocs<Activity>(snap.docs))),
      onSnapshot(col(uid, "providers"), (snap) => setProviders(mapDocs<ServiceProvider>(snap.docs))),
      onSnapshot(col(uid, "activitySettlements"), (snap) =>
        setSettlements(mapDocs<ActivitySettlement>(snap.docs)),
      ),
    ];

    const range = lastNMonthsRange(18);
    const txQuery = query(
      col(uid, "transactions"),
      where("date", ">=", range.start),
      where("date", "<=", range.end),
      orderBy("date", "desc"),
      limit(1000),
    );
    unsubs.push(
      onSnapshot(txQuery, (snap) => {
        setTransactions(mapDocs<Transaction>(snap.docs));
        setLoading(false);
      }),
    );

    const recordQuery = query(
      col(uid, "activityRecords"),
      where("date", ">=", range.start),
      where("date", "<=", range.end),
    );
    unsubs.push(onSnapshot(recordQuery, (snap) => setActivityRecords(mapDocs<ActivityRecord>(snap.docs))));

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [uid]);

  const saveAccount = useCallback(
    async (
      input: Omit<Account, "id" | "createdAt" | "updatedAt" | "currentBalance" | "outstanding" | "archived">,
      id?: string,
    ) => {
      if (!uid) throw new Error("Not signed in");
      if (id) {
        await updateDocAt(uid, "accounts", id, input);
        return id;
      }
      return createAccount(uid, input);
    },
    [uid],
  );

  const archiveAccount = useCallback(
    async (id: string) => {
      if (!uid) return;
      await updateDocAt(uid, "accounts", id, { archived: true });
    },
    [uid],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDocAt(uid, "accounts", id);
    },
    [uid],
  );

  const saveCategory = useCallback(
    async (input: Omit<Category, "id" | "createdAt" | "updatedAt" | "isDefault">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "categories", id, input);
      else await addDocAt(uid, "categories", { ...input, isDefault: false });
    },
    [uid],
  );

  const removeCategory = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDocAt(uid, "categories", id);
    },
    [uid],
  );

  const saveTransaction = useCallback(
    async (input: TransactionInput, id?: string) => {
      if (!uid) throw new Error("Not signed in");
      if (id) {
        const previous = transactions.find((item) => item.id === id);
        if (!previous) throw new Error("Transaction not found");
        await updateTransaction(uid, accounts, previous, input);
        return id;
      }
      const extras: { loanRemainingDelta?: number; goalDelta?: number; goalId?: string; loanId?: string } = {};
      if (input.loanId && input.principalAmount) {
        const loan = loans.find((item) => item.id === input.loanId);
        if (loan) {
          extras.loanId = loan.id;
          extras.loanRemainingDelta = roundMoney(Math.max(0, loan.remainingAmount - input.principalAmount));
        }
      }
      if (input.goalId) {
        const goal = goals.find((item) => item.id === input.goalId);
        if (goal) {
          extras.goalId = goal.id;
          extras.goalDelta = roundMoney(goal.currentAmount + input.amount);
        }
      }
      return createTransaction(uid, accounts, input, extras);
    },
    [uid, accounts, transactions, loans, goals],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      if (!uid) return;
      const tx = transactions.find((item) => item.id === id);
      if (!tx) return;
      if (tx.loanId && tx.principalAmount) {
        const loan = loans.find((item) => item.id === tx.loanId);
        if (loan) {
          await updateDocAt(uid, "loans", loan.id, {
            remainingAmount: roundMoney(loan.remainingAmount + tx.principalAmount),
          });
        }
      }
      if (tx.goalId) {
        const goal = goals.find((item) => item.id === tx.goalId);
        if (goal) {
          await updateDocAt(uid, "goals", goal.id, {
            currentAmount: roundMoney(Math.max(0, goal.currentAmount - tx.amount)),
          });
        }
      }
      await deleteTransaction(uid, accounts, tx);
    },
    [uid, transactions, accounts, loans, goals],
  );

  const saveBudget = useCallback(
    async (input: Omit<Budget, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "budgets", id, input);
      else await addDocAt(uid, "budgets", input);
    },
    [uid],
  );

  const removeBudget = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "budgets", id);
  }, [uid]);

  const saveGoal = useCallback(
    async (input: Omit<Goal, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "goals", id, input);
      else await addDocAt(uid, "goals", input);
    },
    [uid],
  );

  const contributeToGoal = useCallback(
    async (goalId: string, amount: number, fromAccountId?: string) => {
      const goal = goals.find((item) => item.id === goalId);
      if (!goal || !uid) return;
      if (fromAccountId && goal.accountId && fromAccountId !== goal.accountId) {
        await saveTransaction({
          type: "transfer",
          amount,
          date: new Date().toISOString().slice(0, 10),
          description: `Contribution to ${goal.name}`,
          categoryId: null,
          accountId: null,
          fromAccountId,
          toAccountId: goal.accountId,
          tags: ["goal"],
          isCreditCardPayment: false,
          status: "cleared",
          goalId,
        });
        return;
      }
      await updateDocAt(uid, "goals", goalId, {
        currentAmount: roundMoney(goal.currentAmount + amount),
      });
    },
    [goals, uid, saveTransaction],
  );

  const removeGoal = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "goals", id);
  }, [uid]);

  const saveLoan = useCallback(
    async (input: Omit<Loan, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "loans", id, input);
      else await addDocAt(uid, "loans", input);
    },
    [uid],
  );

  const payLoan = useCallback(
    async (loanId: string, principal: number, interest: number, accountId: string, date: string) => {
      const loan = loans.find((item) => item.id === loanId);
      if (!loan) return;
      const interestCategory = categories.find(
        (item) => item.kind === "expense" && item.name.toLowerCase() === "interest",
      );
      await saveTransaction({
        type: "expense",
        amount: roundMoney(principal + interest),
        date,
        description: `${loan.name} payment`,
        categoryId: interestCategory?.id ?? null,
        accountId,
        fromAccountId: null,
        toAccountId: null,
        tags: ["loan"],
        isCreditCardPayment: false,
        status: "cleared",
        loanId,
        principalAmount: principal,
        interestAmount: interest,
      });
    },
    [loans, categories, saveTransaction],
  );

  const removeLoan = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "loans", id);
  }, [uid]);

  const saveBill = useCallback(
    async (input: Omit<Bill, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "bills", id, input);
      else await addDocAt(uid, "bills", input);
    },
    [uid],
  );

  const markBillPaid = useCallback(
    async (billId: string, accountId: string) => {
      if (!uid) return;
      const bill = bills.find((item) => item.id === billId);
      if (!bill) return;
      const txId = await saveTransaction({
        type: "expense",
        amount: bill.amount,
        date: new Date().toISOString().slice(0, 10),
        description: bill.name,
        categoryId: bill.categoryId ?? null,
        accountId,
        fromAccountId: null,
        toAccountId: null,
        tags: ["bill"],
        isCreditCardPayment: false,
        status: "cleared",
      });
      await updateDocAt(uid, "bills", billId, {
        lastPaidDate: new Date().toISOString().slice(0, 10),
        lastPaidTransactionId: txId,
      });
    },
    [uid, bills, saveTransaction],
  );

  const removeBill = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "bills", id);
  }, [uid]);

  const saveRecurring = useCallback(
    async (input: Omit<RecurringTransaction, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "recurringTransactions", id, input);
      else await addDocAt(uid, "recurringTransactions", input);
    },
    [uid],
  );

  const removeRecurring = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "recurringTransactions", id);
  }, [uid]);

  const saveInvestment = useCallback(
    async (input: Omit<Investment, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) return;
      if (id) await updateDocAt(uid, "investments", id, input);
      else await addDocAt(uid, "investments", input);
    },
    [uid],
  );

  const removeInvestment = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "investments", id);
  }, [uid]);

  const saveActivity = useCallback(
    async (input: Omit<Activity, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) throw new Error("Not signed in");
      const payload = {
        ...input,
        pauses: input.pauses ?? [],
        activeDays: input.activeDays ?? [],
        defaultQuantity: input.defaultQuantity ?? 1,
        autoCreateExpense: input.autoCreateExpense ?? false,
        autoSettle: input.autoSettle ?? false,
      };
      if (id) {
        await updateDocAt(uid, "activities", id, payload);
        return id;
      }
      return addDocAt(uid, "activities", payload);
    },
    [uid],
  );

  const removeActivity = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "activities", id);
  }, [uid]);

  const saveProvider = useCallback(
    async (input: Omit<ServiceProvider, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) throw new Error("Not signed in");
      if (id) {
        await updateDocAt(uid, "providers", id, input);
        return id;
      }
      return addDocAt(uid, "providers", input);
    },
    [uid],
  );

  const removeProvider = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDocAt(uid, "providers", id);
  }, [uid]);

  const checkIn = useCallback(
    async (input: {
      activityId: string;
      date?: string;
      status: Exclude<ActivityCheckStatus, "pending" | "missed">;
      quantity?: number;
      skipReason?: SkipReason;
      notes?: string;
    }) => {
      if (!uid) return;
      const activity = activities.find((item) => item.id === input.activityId);
      if (!activity) throw new Error("Activity not found");
      const date = input.date ?? todayISO();
      const existing = activityRecords.find((item) => item.activityId === activity.id && item.date === date);
      const record = buildCheckRecord({
        activity,
        date,
        status: input.status,
        quantity: input.quantity,
        skipReason: input.skipReason,
        notes: input.notes,
        existing,
      });
      await upsertDocAt(uid, "activityRecords", `${activity.id}_${date}`, record);
    },
    [uid, activities, activityRecords],
  );

  const bulkCheckIn = useCallback(
    async (activityIds: string[], status: "completed" | "skipped", date?: string) => {
      for (const activityId of activityIds) {
        await checkIn({ activityId, status, date });
      }
    },
    [checkIn],
  );

  const pauseActivity = useCallback(
    async (activityId: string, pause: ActivityPause) => {
      if (!uid) return;
      const activity = activities.find((item) => item.id === activityId);
      if (!activity) return;
      await updateDocAt(uid, "activities", activityId, {
        pauses: [...(activity.pauses ?? []), pause],
      });
    },
    [uid, activities],
  );

  const resumeActivity = useCallback(
    async (activityId: string) => {
      if (!uid) return;
      await updateDocAt(uid, "activities", activityId, { status: "active" });
    },
    [uid],
  );

  const paySettlement = useCallback(
    async (input: {
      activityId: string;
      month: string;
      amount: number;
      accountId: string;
      date: string;
      createExpense?: boolean;
      paymentMethod?: Transaction["paymentMethod"];
    }) => {
      if (!uid) throw new Error("Not signed in");
      const activity = activities.find((item) => item.id === input.activityId);
      if (!activity) throw new Error("Activity not found");
      const id = settlementId(activity.id, input.month);
      const existing = settlements.find((item) => item.id === id);
      const snapshot = snapshotSettlement(activity, activityRecords, input.month, existing);
      const due = roundMoney(Math.max(0, snapshot.amount - snapshot.paidAmount));
      const payAmount = roundMoney(Math.min(input.amount, due));
      if (payAmount <= 0) throw new Error("Nothing due for this month");

      const createExpense = input.createExpense !== false;
      let transactionId: string | undefined;
      if (createExpense) {
        transactionId = await saveTransaction({
          type: "expense",
          amount: payAmount,
          date: input.date,
          description: `${activity.name} — ${input.month}`,
          categoryId: activity.expenseCategoryId ?? activity.categoryId ?? null,
          accountId: input.accountId,
          fromAccountId: null,
          toAccountId: null,
          paymentMethod: input.paymentMethod,
          tags: ["daily-check"],
          isCreditCardPayment: false,
          status: "cleared",
          activityId: activity.id,
          settlementId: id,
        });
      }

      const next = applySettlementPayment(
        { ...snapshot, ...existing, id, transactionIds: existing?.transactionIds ?? snapshot.transactionIds },
        payAmount,
        transactionId,
      );
      await upsertDocAt(uid, "activitySettlements", id, next);
    },
    [uid, activities, activityRecords, settlements, saveTransaction],
  );

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!uid) return;
      await updateUserProfile(uid, patch);
    },
    [uid],
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      loading,
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      loans,
      bills,
      recurring,
      investments,
      activities,
      activityRecords,
      providers,
      settlements,
      saveAccount,
      archiveAccount,
      removeAccount,
      saveCategory,
      removeCategory,
      saveTransaction,
      removeTransaction,
      saveBudget,
      removeBudget,
      saveGoal,
      contributeToGoal,
      removeGoal,
      saveLoan,
      payLoan,
      removeLoan,
      saveBill,
      markBillPaid,
      removeBill,
      saveRecurring,
      removeRecurring,
      saveInvestment,
      removeInvestment,
      saveActivity,
      removeActivity,
      saveProvider,
      removeProvider,
      checkIn,
      bulkCheckIn,
      pauseActivity,
      resumeActivity,
      paySettlement,
      updateProfile,
      quickAddOpen,
      quickAddKind,
      openQuickAdd: (kind: QuickAddKind = "expense") => {
        setQuickAddKind(kind);
        setQuickAddOpen(true);
      },
      closeQuickAdd: () => setQuickAddOpen(false),
    }),
    [
      loading,
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      loans,
      bills,
      recurring,
      investments,
      activities,
      activityRecords,
      providers,
      settlements,
      saveAccount,
      archiveAccount,
      removeAccount,
      saveCategory,
      removeCategory,
      saveTransaction,
      removeTransaction,
      saveBudget,
      removeBudget,
      saveGoal,
      contributeToGoal,
      removeGoal,
      saveLoan,
      payLoan,
      removeLoan,
      saveBill,
      markBillPaid,
      removeBill,
      saveRecurring,
      removeRecurring,
      saveInvestment,
      removeInvestment,
      saveActivity,
      removeActivity,
      saveProvider,
      removeProvider,
      checkIn,
      bulkCheckIn,
      pauseActivity,
      resumeActivity,
      paySettlement,
      updateProfile,
      quickAddOpen,
      quickAddKind,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
