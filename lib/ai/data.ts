import { getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { toIso, userDoc, withId, col } from "@/services/helpers";
import { lastNMonthsRange } from "@/lib/utils/dates";
import { nowInTimezone, todayInTimezone } from "@/lib/ai/dates";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AIContextSnapshotMeta } from "@/lib/ai/types";
import type {
  Account,
  Activity,
  ActivityRecord,
  ActivitySettlement,
  Bill,
  Budget,
  Category,
  Goal,
  Investment,
  Loan,
  Person,
  RecurringTransaction,
  Transaction,
  Udhar,
  UdharRepayment,
  UserProfile,
} from "@/types";

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

export interface FinanceSnapshot {
  profile: UserProfile | null;
  meta: AIContextSnapshotMeta;
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
  settlements: ActivitySettlement[];
  people: Person[];
  udhars: Udhar[];
  udharRepayments: UdharRepayment[];
}

export async function loadFinanceSnapshot(uid: string): Promise<FinanceSnapshot> {
  const range = lastNMonthsRange(18, nowInTimezone());
  const [
    profileSnap,
    accountsSnap,
    categoriesSnap,
    budgetsSnap,
    goalsSnap,
    loansSnap,
    billsSnap,
    recurringSnap,
    investmentsSnap,
    activitiesSnap,
    settlementsSnap,
    peopleSnap,
    udharSnap,
    repaymentsSnap,
    transactionsSnap,
    recordsSnap,
  ] = await Promise.all([
    getDoc(userDoc(uid)),
    getDocs(col(uid, "accounts")),
    getDocs(col(uid, "categories")),
    getDocs(col(uid, "budgets")),
    getDocs(col(uid, "goals")),
    getDocs(col(uid, "loans")),
    getDocs(col(uid, "bills")),
    getDocs(col(uid, "recurringTransactions")),
    getDocs(col(uid, "investments")),
    getDocs(col(uid, "activities")),
    getDocs(col(uid, "activitySettlements")),
    getDocs(col(uid, "people")),
    getDocs(col(uid, "udhar")),
    getDocs(col(uid, "udharRepayments")),
    getDocs(
      query(
        col(uid, "transactions"),
        where("date", ">=", range.start),
        where("date", "<=", range.end),
        orderBy("date", "desc"),
        limit(1000),
      ),
    ),
    getDocs(
      query(
        col(uid, "activityRecords"),
        where("date", ">=", range.start),
        where("date", "<=", range.end),
      ),
    ),
  ]);

  const profile = profileSnap.exists()
    ? withId<UserProfile>(profileSnap.id, profileSnap.data() as Record<string, unknown>)
    : null;

  const timezone = AI_CONFIG.timezone;
  const today = todayInTimezone(timezone);

  return {
    profile,
    meta: {
      today,
      timezone,
      currency: profile?.currency ?? "INR",
      dateFormat: profile?.dateFormat ?? "dd MMM yyyy",
      monthStartDay: profile?.monthStartDay ?? 1,
      displayName: profile?.displayName ?? "",
    },
    accounts: mapDocs<Account>(accountsSnap.docs),
    categories: mapDocs<Category>(categoriesSnap.docs),
    transactions: mapDocs<Transaction>(transactionsSnap.docs),
    budgets: mapDocs<Budget>(budgetsSnap.docs),
    goals: mapDocs<Goal>(goalsSnap.docs),
    loans: mapDocs<Loan>(loansSnap.docs),
    bills: mapDocs<Bill>(billsSnap.docs),
    recurring: mapDocs<RecurringTransaction>(recurringSnap.docs),
    investments: mapDocs<Investment>(investmentsSnap.docs),
    activities: mapDocs<Activity>(activitiesSnap.docs),
    activityRecords: mapDocs<ActivityRecord>(recordsSnap.docs),
    settlements: mapDocs<ActivitySettlement>(settlementsSnap.docs),
    people: mapDocs<Person>(peopleSnap.docs),
    udhars: mapDocs<Udhar>(udharSnap.docs),
    udharRepayments: mapDocs<UdharRepayment>(repaymentsSnap.docs),
  };
}

export function directoryForPrompt(snapshot: FinanceSnapshot): string {
  const accounts = snapshot.accounts
    .filter((item) => !item.archived)
    .map((item) => item.name)
    .join(", ");
  const expense = snapshot.categories
    .filter((item) => item.kind === "expense")
    .map((item) => item.name)
    .join(", ");
  const income = snapshot.categories
    .filter((item) => item.kind === "income")
    .map((item) => item.name)
    .join(", ");
  const people = snapshot.people.map((item) => item.name).join(", ");
  const goals = snapshot.goals.map((item) => item.name).join(", ");
  const bills = snapshot.bills.map((item) => item.name).join(", ");
  const activities = snapshot.activities
    .filter((item) => item.status !== "archived")
    .map((item) => item.name)
    .join(", ");
  return [
    `Today: ${snapshot.meta.today} (${snapshot.meta.timezone})`,
    `Currency: ${snapshot.meta.currency}`,
    accounts ? `Accounts: ${accounts}` : "Accounts: none",
    income ? `Income categories: ${income}` : "Income categories: none",
    expense ? `Expense categories: ${expense}` : "Expense categories: none",
    people ? `People: ${people}` : "People: none",
    goals ? `Goals: ${goals}` : "Goals: none",
    bills ? `Bills: ${bills}` : "Bills: none",
    activities ? `Daily Check activities: ${activities}` : "Daily Check activities: none",
  ].join("\n");
}
