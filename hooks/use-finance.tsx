"use client";

import {
  deleteField,
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
  useRef,
  useState,
} from "react";
import { format, parseISO } from "date-fns";
import { archiveEndDate } from "@/lib/finance/activity-calculations";
import { isAssetAccount } from "@/lib/finance/calculations";
import {
  absorbEmiPrincipal,
  convertibleCharges,
  creditEmiBills as buildCreditEmiBills,
  openingAvailable,
  splitEmiPayment,
  type CreditEmiBill,
} from "@/lib/finance/credit-emi";
import {
  creditCardStatements,
  type CreditStatement,
  type UnbilledCredit,
} from "@/lib/finance/credit-statements";
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
import {
  addNoteAttachment,
  archiveNote as archiveNoteDoc,
  createNote,
  deleteNotePermanently,
  mapNote,
  mapNoteCategory,
  moveNoteToTrash,
  purgeExpiredTrash,
  removeNoteAttachment,
  removeNoteCategory as removeNoteCategoryDoc,
  restoreFromTrash,
  restoreNote as restoreNoteDoc,
  saveNote as saveNoteDoc,
  saveNoteCategory as saveNoteCategoryDoc,
  seedDefaultNoteCategories,
  setNotePinned,
  type NoteInput,
} from "@/services/notes";
import { DEFAULT_NOTE_TRASH_DAYS } from "@/constants/notes";
import { createAccount, updateUserProfile } from "@/services/users";
import {
  addPersonNote,
  cancelUdhar,
  createPersonInline,
  createUdhar,
  dismissUdharFollowUp,
  recordPersonRepayment,
  recordUdharRepayment,
  removePerson,
  removePersonNote,
  removeUdhar,
  savePerson,
  settlePersonNet,
  settleUdhar,
} from "@/services/udhar";
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
  CreditEmi,
  Goal,
  Investment,
  Loan,
  Note,
  NoteAttachment,
  NoteCategory,
  Person,
  PersonNote,
  QuickAddKind,
  RecurringTransaction,
  ServiceProvider,
  SkipReason,
  Transaction,
  Udhar,
  UdharPaymentMethod,
  UdharRepayment,
  UdharType,
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
  people: Person[];
  udhars: Udhar[];
  udharRepayments: UdharRepayment[];
  peopleNotes: PersonNote[];
  notes: Note[];
  noteCategories: NoteCategory[];
  saveNote: (input: NoteInput, id?: string) => Promise<string>;
  pinNote: (id: string, isPinned: boolean) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreTrashedNote: (id: string) => Promise<void>;
  deleteNoteForever: (id: string) => Promise<void>;
  addNoteFile: (noteId: string, file: NoteAttachment) => Promise<void>;
  removeNoteFile: (noteId: string, attachmentId: string) => Promise<void>;
  saveNoteCategory: (input: { name: string; icon?: string; color?: string }, id?: string) => Promise<string>;
  removeNoteCategory: (id: string) => Promise<void>;
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
  creditStatements: CreditStatement[];
  unbilledCredit: UnbilledCredit[];
  payCreditStatement: (accountId: string, fromAccountId: string, amount: number, statementId: string) => Promise<void>;
  creditEmis: CreditEmi[];
  creditEmiBills: CreditEmiBill[];
  createCreditEmi: (input: {
    accountId: string;
    name: string;
    principalAmount: number;
    monthlyAmount: number;
    monthlyInterest: number;
    startDate: string;
    transactionIds: string[] | null;
  }) => Promise<void>;
  payCreditEmi: (emiId: string, fromAccountId: string, amount: number) => Promise<void>;
  removeCreditEmi: (id: string) => Promise<void>;
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
    amount?: number;
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
  savePerson: (input: Omit<Person, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<string>;
  removePerson: (id: string) => Promise<void>;
  saveUdhar: (
    input: {
      personId?: string;
      newPersonName?: string;
      newPersonPhone?: string;
      newPersonRelationship?: Person["relationship"];
      type: UdharType;
      principalAmount: number;
      date: string;
      dueDate?: string | null;
      accountId: string;
      interestType: Udhar["interestType"];
      interestAmount?: number;
      interestRate?: number;
      notes?: string;
      reminderDays?: number;
      remindInDailyCheck?: boolean;
      attachments?: Transaction["attachments"];
    },
  ) => Promise<string>;
  repayUdhar: (input: {
    udharId?: string;
    personId: string;
    type: UdharType;
    amount: number;
    accountId: string;
    paymentDate: string;
    paymentMethod: UdharPaymentMethod;
    notes?: string;
    attachments?: Transaction["attachments"];
  }) => Promise<void>;
  settleUdharFull: (input: {
    udharId: string;
    accountId: string;
    paymentDate: string;
    paymentMethod: UdharPaymentMethod;
    notes?: string;
  }) => Promise<void>;
  settleNet: (input: {
    personId: string;
    accountId: string;
    paymentDate: string;
    paymentMethod: UdharPaymentMethod;
    notes?: string;
  }) => Promise<void>;
  cancelUdhar: (id: string) => Promise<void>;
  removeUdhar: (id: string) => Promise<void>;
  dismissUdharFollowUp: (id: string) => Promise<void>;
  addPersonNote: (input: Omit<PersonNote, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  removePersonNote: (id: string) => Promise<void>;
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
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const [loading, setLoading] = useState(Boolean(uid));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [creditEmis, setCreditEmis] = useState<CreditEmi[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [settlements, setSettlements] = useState<ActivitySettlement[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [udhars, setUdhars] = useState<Udhar[]>([]);
  const [udharRepayments, setUdharRepayments] = useState<UdharRepayment[]>([]);
  const [peopleNotes, setPeopleNotes] = useState<PersonNote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteCategories, setNoteCategories] = useState<NoteCategory[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddKind, setQuickAddKind] = useState<QuickAddKind>("expense");
  const trashPurged = useRef(false);

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
      onSnapshot(col(uid, "creditEmis"), (snap) => setCreditEmis(mapDocs<CreditEmi>(snap.docs))),
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
      onSnapshot(col(uid, "people"), (snap) => setPeople(mapDocs<Person>(snap.docs))),
      onSnapshot(col(uid, "udhar"), (snap) => setUdhars(mapDocs<Udhar>(snap.docs))),
      onSnapshot(col(uid, "udharRepayments"), (snap) =>
        setUdharRepayments(mapDocs<UdharRepayment>(snap.docs)),
      ),
      onSnapshot(col(uid, "peopleNotes"), (snap) => setPeopleNotes(mapDocs<PersonNote>(snap.docs))),
      onSnapshot(col(uid, "notes"), (snap) => {
        const items = snap.docs.map((item) => mapNote(item.id, item.data()));
        setNotes(items);
      }),
      onSnapshot(col(uid, "noteCategories"), (snap) => {
        const items = snap.docs.map((item) => mapNoteCategory(item.id, item.data()));
        setNoteCategories(items);
        if (items.length === 0) {
          void seedDefaultNoteCategories(uid);
        }
      }),
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

  useEffect(() => {
    if (!uid) {
      trashPurged.current = false;
      return;
    }
    if (!notes.length || trashPurged.current) return;
    trashPurged.current = true;
    const days = profile?.noteTrashDays ?? DEFAULT_NOTE_TRASH_DAYS;
    void purgeExpiredTrash(uid, notes, days);
  }, [uid, notes, profile?.noteTrashDays]);

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
      if (tx.udharId) {
        throw new Error("Manage this from People & Udhar so balances stay in sync");
      }
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

  const { statements: creditStatements, unbilled: unbilledCredit } = useMemo(
    () => creditCardStatements(accounts, transactions, todayISO(), creditEmis),
    [accounts, transactions, creditEmis],
  );

  const creditEmiBills = useMemo(
    () => buildCreditEmiBills(creditEmis, accounts),
    [accounts, creditEmis],
  );

  const createCreditEmi = useCallback(
    async (input: {
      accountId: string;
      name: string;
      principalAmount: number;
      monthlyAmount: number;
      monthlyInterest: number;
      startDate: string;
      transactionIds: string[] | null;
    }) => {
      if (!uid) throw new Error("Not signed in");
      const card = accounts.find((item) => item.id === input.accountId);
      if (!card || card.kind !== "credit" || card.archived) throw new Error("Choose a credit card");
      const principal = roundMoney(input.principalAmount);
      const monthlyAmount = roundMoney(input.monthlyAmount);
      const monthlyInterest = roundMoney(input.monthlyInterest);
      if (principal <= 0) throw new Error("Enter an amount to convert");
      if (principal > roundMoney(card.outstanding)) throw new Error("Amount is more than the outstanding on this card");
      if (monthlyAmount <= 0) throw new Error("Enter the monthly EMI");
      if (monthlyInterest < 0 || monthlyInterest >= monthlyAmount) {
        throw new Error("Interest must be less than the monthly EMI");
      }
      const charges = convertibleCharges(card, transactions, accounts, creditEmis);
      const plan = absorbEmiPrincipal(
        principal,
        charges,
        input.transactionIds,
        openingAvailable(card, creditEmis),
      );
      await addDocAt(uid, "creditEmis", {
        accountId: card.id,
        name: input.name.trim() || `${card.name} EMI`,
        principalAmount: principal,
        remainingPrincipal: principal,
        monthlyAmount,
        monthlyInterest,
        interestPaid: 0,
        startDate: input.startDate,
        absorbed: plan.absorbed,
        openingAmount: plan.openingAmount,
      });
    },
    [uid, accounts, transactions, creditEmis],
  );

  const payCreditEmi = useCallback(
    async (emiId: string, fromAccountId: string, amount: number) => {
      if (!uid) throw new Error("Not signed in");
      const plan = creditEmis.find((item) => item.id === emiId);
      if (!plan) throw new Error("EMI plan not found");
      const card = accounts.find((item) => item.id === plan.accountId);
      const from = accounts.find((item) => item.id === fromAccountId);
      if (!card || card.kind !== "credit") throw new Error("Choose a credit card");
      if (!from || from.archived || !isAssetAccount(from)) throw new Error("Choose a bank or cash account");
      const target = creditEmiBills
        .filter((item) => item.emiId === emiId && item.remaining > 0)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      if (!target) throw new Error("Nothing is due on this EMI");
      const pay = roundMoney(amount);
      if (pay <= 0) throw new Error("Enter an amount");
      if (pay > target.remaining) throw new Error("Amount is more than this EMI installment");
      const { principal, interest } = splitEmiPayment(target, pay);
      const date = todayISO();
      if (principal > 0) {
        await saveTransaction({
          type: "transfer",
          amount: principal,
          date,
          description: `${plan.name} EMI`,
          categoryId: null,
          accountId: null,
          fromAccountId,
          toAccountId: card.id,
          tags: ["credit-card", "emi"],
          isCreditCardPayment: true,
          status: "cleared",
          emiId: plan.id,
        });
      }
      if (interest > 0) {
        const interestCategory = categories.find(
          (item) => item.kind === "expense" && item.name.toLowerCase() === "interest",
        );
        await saveTransaction({
          type: "expense",
          amount: interest,
          date,
          description: `${plan.name} interest`,
          categoryId: interestCategory?.id ?? null,
          accountId: fromAccountId,
          fromAccountId: null,
          toAccountId: null,
          tags: ["credit-card", "emi"],
          isCreditCardPayment: false,
          status: "cleared",
          emiId: plan.id,
        });
      }
      await updateDocAt(uid, "creditEmis", plan.id, {
        remainingPrincipal: roundMoney(Math.max(0, plan.remainingPrincipal - principal)),
        interestPaid: roundMoney((plan.interestPaid ?? 0) + interest),
      });
    },
    [uid, accounts, categories, creditEmis, creditEmiBills, saveTransaction],
  );

  const removeCreditEmi = useCallback(
    async (id: string) => {
      if (!uid) return;
      const linked = transactions.filter((item) => item.emiId === id);
      for (const item of linked) {
        await updateDocAt(uid, "transactions", item.id, { emiId: deleteField() });
      }
      await deleteDocAt(uid, "creditEmis", id);
    },
    [uid, transactions],
  );

  const payCreditStatement = useCallback(
    async (accountId: string, fromAccountId: string, amount: number, statementId: string) => {
      if (!uid) throw new Error("Not signed in");
      const card = accounts.find((item) => item.id === accountId);
      if (!card || card.kind !== "credit" || card.archived) throw new Error("Choose a credit card");
      const from = accounts.find((item) => item.id === fromAccountId);
      if (!from || from.archived || !isAssetAccount(from)) {
        throw new Error("Choose a bank or cash account");
      }
      const statement = creditStatements.find((item) => item.id === statementId && item.accountId === accountId);
      if (!statement || statement.remaining <= 0) throw new Error("This statement is already paid");
      const pay = roundMoney(amount);
      if (pay <= 0) throw new Error("Enter an amount");
      if (pay > statement.remaining) throw new Error("Amount is more than this statement");
      await saveTransaction({
        type: "transfer",
        amount: pay,
        date: todayISO(),
        description: `${card.name} bill payment`,
        categoryId: null,
        accountId: null,
        fromAccountId,
        toAccountId: card.id,
        tags: ["credit-card", "bill"],
        isCreditCardPayment: true,
        statementId,
        status: "cleared",
      });
    },
    [uid, accounts, creditStatements, saveTransaction],
  );

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
    const activity = activities.find((item) => item.id === id);
    const today = todayISO();
    const keepToday = activityRecords.some((item) => item.activityId === id && item.date === today);
    await updateDocAt(uid, "activities", id, {
      status: "archived",
      endDate: archiveEndDate({ endDate: activity?.endDate }, today, keepToday),
    });
  }, [uid, activities, activityRecords]);

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
      amount?: number;
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
        amount: input.amount,
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
          description: `${activity.name} - ${format(parseISO(`${input.month}-01`), "MMMM yyyy")}`,
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

  const savePersonRecord = useCallback(
    async (input: Omit<Person, "id" | "createdAt" | "updatedAt">, id?: string) => {
      if (!uid) throw new Error("Not signed in");
      return savePerson(uid, input, id);
    },
    [uid],
  );

  const removePersonRecord = useCallback(
    async (id: string) => {
      if (!uid) return;
      await removePerson(uid, id, udhars);
    },
    [uid, udhars],
  );

  const saveUdharRecord = useCallback(
    async (input: {
      personId?: string;
      newPersonName?: string;
      newPersonPhone?: string;
      newPersonRelationship?: Person["relationship"];
      type: UdharType;
      principalAmount: number;
      date: string;
      dueDate?: string | null;
      accountId: string;
      interestType: Udhar["interestType"];
      interestAmount?: number;
      interestRate?: number;
      notes?: string;
      reminderDays?: number;
      remindInDailyCheck?: boolean;
      attachments?: Transaction["attachments"];
    }) => {
      if (!uid) throw new Error("Not signed in");
      let person = people.find((item) => item.id === input.personId);
      if (!person) {
        if (!input.newPersonName?.trim()) throw new Error("Choose or add a person");
        const personId = await createPersonInline(uid, {
          name: input.newPersonName,
          phone: input.newPersonPhone,
          relationship: input.newPersonRelationship,
        });
        person = {
          id: personId,
          name: input.newPersonName.trim(),
          phone: input.newPersonPhone,
          relationship: input.newPersonRelationship,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return createUdhar(uid, accounts, person, {
        personId: person.id,
        type: input.type,
        principalAmount: input.principalAmount,
        date: input.date,
        dueDate: input.dueDate,
        accountId: input.accountId,
        interestType: input.interestType,
        interestAmount: input.interestAmount,
        interestRate: input.interestRate,
        notes: input.notes,
        reminderDays: input.reminderDays,
        remindInDailyCheck: input.remindInDailyCheck,
        attachments: input.attachments,
      });
    },
    [uid, people, accounts],
  );

  const repayUdharRecord = useCallback(
    async (input: {
      udharId?: string;
      personId: string;
      type: UdharType;
      amount: number;
      accountId: string;
      paymentDate: string;
      paymentMethod: UdharPaymentMethod;
      notes?: string;
      attachments?: Transaction["attachments"];
    }) => {
      if (!uid) throw new Error("Not signed in");
      const person = people.find((item) => item.id === input.personId);
      if (!person) throw new Error("Person not found");
      const repayment = {
        amount: input.amount,
        accountId: input.accountId,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        attachments: input.attachments,
      };
      if (input.udharId) {
        const udhar = udhars.find((item) => item.id === input.udharId);
        if (!udhar) throw new Error("Udhar record not found");
        await recordUdharRepayment({
          uid,
          accounts,
          categories,
          person,
          udhar,
          repayments: udharRepayments,
          repayment,
        });
        return;
      }
      await recordPersonRepayment({
        uid,
        accounts,
        categories,
        person,
        udhars,
        repayments: udharRepayments,
        type: input.type,
        repayment,
      });
    },
    [uid, people, udhars, udharRepayments, accounts, categories],
  );

  const settleUdharFull = useCallback(
    async (input: {
      udharId: string;
      accountId: string;
      paymentDate: string;
      paymentMethod: UdharPaymentMethod;
      notes?: string;
    }) => {
      if (!uid) throw new Error("Not signed in");
      const udhar = udhars.find((item) => item.id === input.udharId);
      if (!udhar) throw new Error("Udhar record not found");
      const person = people.find((item) => item.id === udhar.personId);
      if (!person) throw new Error("Person not found");
      await settleUdhar({
        uid,
        accounts,
        categories,
        person,
        udhar,
        repayments: udharRepayments,
        accountId: input.accountId,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      });
    },
    [uid, udhars, people, accounts, categories, udharRepayments],
  );

  const settleNetRecord = useCallback(
    async (input: {
      personId: string;
      accountId: string;
      paymentDate: string;
      paymentMethod: UdharPaymentMethod;
      notes?: string;
    }) => {
      if (!uid) throw new Error("Not signed in");
      const person = people.find((item) => item.id === input.personId);
      if (!person) throw new Error("Person not found");
      await settlePersonNet({
        uid,
        accounts,
        categories,
        person,
        udhars,
        repayments: udharRepayments,
        accountId: input.accountId,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      });
    },
    [uid, people, accounts, categories, udhars, udharRepayments],
  );

  const cancelUdharRecord = useCallback(
    async (id: string) => {
      if (!uid) return;
      const udhar = udhars.find((item) => item.id === id);
      if (!udhar) return;
      await cancelUdhar(uid, udhar);
    },
    [uid, udhars],
  );

  const removeUdharRecord = useCallback(
    async (id: string) => {
      if (!uid) return;
      const udhar = udhars.find((item) => item.id === id);
      if (!udhar) return;
      await removeUdhar(uid, accounts, udhar, udharRepayments, transactions);
    },
    [uid, accounts, udhars, udharRepayments, transactions],
  );

  const dismissFollowUp = useCallback(
    async (id: string) => {
      if (!uid) return;
      await dismissUdharFollowUp(uid, id, todayISO());
    },
    [uid],
  );

  const addNoteRecord = useCallback(
    async (input: Omit<PersonNote, "id" | "createdAt" | "updatedAt">) => {
      if (!uid) throw new Error("Not signed in");
      return addPersonNote(uid, input);
    },
    [uid],
  );

  const removeNoteRecord = useCallback(
    async (id: string) => {
      if (!uid) return;
      await removePersonNote(uid, id);
    },
    [uid],
  );

  const saveJournalNote = useCallback(
    async (input: NoteInput, id?: string) => {
      if (!uid) throw new Error("Not signed in");
      if (id) {
        const previous = notes.find((item) => item.id === id);
        await saveNoteDoc(uid, id, input, previous);
        return id;
      }
      return createNote(uid, input);
    },
    [uid, notes],
  );

  const pinNote = useCallback(
    async (id: string, isPinned: boolean) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      await setNotePinned(uid, note, isPinned);
    },
    [uid, notes],
  );

  const archiveJournalNote = useCallback(
    async (id: string) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      await archiveNoteDoc(uid, note);
    },
    [uid, notes],
  );

  const restoreJournalNote = useCallback(
    async (id: string) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      await restoreNoteDoc(uid, note);
    },
    [uid, notes],
  );

  const trashJournalNote = useCallback(
    async (id: string) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      await moveNoteToTrash(uid, note);
    },
    [uid, notes],
  );

  const restoreTrashedNote = useCallback(
    async (id: string) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      await restoreFromTrash(uid, note);
    },
    [uid, notes],
  );

  const deleteNoteForever = useCallback(
    async (id: string) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === id);
      if (!note) return;
      await deleteNotePermanently(uid, note);
    },
    [uid, notes],
  );

  const addNoteFile = useCallback(
    async (noteId: string, file: NoteAttachment) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === noteId);
      if (!note) return;
      await addNoteAttachment(uid, note, file);
    },
    [uid, notes],
  );

  const removeNoteFile = useCallback(
    async (noteId: string, attachmentId: string) => {
      if (!uid) return;
      const note = notes.find((item) => item.id === noteId);
      if (!note) return;
      await removeNoteAttachment(uid, note, attachmentId);
    },
    [uid, notes],
  );

  const saveJournalCategory = useCallback(
    async (input: { name: string; icon?: string; color?: string }, id?: string) => {
      if (!uid) throw new Error("Not signed in");
      return saveNoteCategoryDoc(uid, input, id);
    },
    [uid],
  );

  const removeJournalCategory = useCallback(
    async (id: string) => {
      if (!uid) return;
      await removeNoteCategoryDoc(uid, id);
    },
    [uid],
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
      people,
      udhars,
      udharRepayments,
      peopleNotes,
      notes,
      noteCategories,
      saveNote: saveJournalNote,
      pinNote,
      archiveNote: archiveJournalNote,
      restoreNote: restoreJournalNote,
      trashNote: trashJournalNote,
      restoreTrashedNote,
      deleteNoteForever,
      addNoteFile,
      removeNoteFile,
      saveNoteCategory: saveJournalCategory,
      removeNoteCategory: removeJournalCategory,
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
      creditStatements,
      unbilledCredit,
      payCreditStatement,
      creditEmis,
      creditEmiBills,
      createCreditEmi,
      payCreditEmi,
      removeCreditEmi,
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
      savePerson: savePersonRecord,
      removePerson: removePersonRecord,
      saveUdhar: saveUdharRecord,
      repayUdhar: repayUdharRecord,
      settleUdharFull,
      settleNet: settleNetRecord,
      cancelUdhar: cancelUdharRecord,
      removeUdhar: removeUdharRecord,
      dismissUdharFollowUp: dismissFollowUp,
      addPersonNote: addNoteRecord,
      removePersonNote: removeNoteRecord,
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
      people,
      udhars,
      udharRepayments,
      peopleNotes,
      notes,
      noteCategories,
      saveJournalNote,
      pinNote,
      archiveJournalNote,
      restoreJournalNote,
      trashJournalNote,
      restoreTrashedNote,
      deleteNoteForever,
      addNoteFile,
      removeNoteFile,
      saveJournalCategory,
      removeJournalCategory,
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
      creditStatements,
      unbilledCredit,
      payCreditStatement,
      creditEmis,
      creditEmiBills,
      createCreditEmi,
      payCreditEmi,
      removeCreditEmi,
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
      savePersonRecord,
      removePersonRecord,
      saveUdharRecord,
      repayUdharRecord,
      settleUdharFull,
      settleNetRecord,
      cancelUdharRecord,
      removeUdharRecord,
      dismissFollowUp,
      addNoteRecord,
      removeNoteRecord,
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
