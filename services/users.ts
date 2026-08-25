import {
  addDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/constants/categories";
import { getDb } from "@/lib/firebase/client";
import { col, nowIso, stripUndefined, userDoc } from "@/services/helpers";
import type {
  Account,
  DashboardWidgets,
  NotificationPrefs,
  UserProfile,
} from "@/types";

export const DEFAULT_WIDGETS: DashboardWidgets = {
  totalBalance: true,
  income: true,
  expenses: true,
  savings: true,
  netWorth: true,
  cashFlow: true,
  spendingBreakdown: true,
  budgets: true,
  goals: true,
  upcomingBills: true,
  recentTransactions: true,
  loans: true,
  creditCards: true,
  dailyCheck: true,
  pendingSettlements: true,
  peopleUdhar: true,
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  bills: true,
  budgets: true,
  goals: true,
  recurring: true,
  dailyCheck: true,
  settlements: true,
  udhar: true,
};

export async function createUserProfile(
  uid: string,
  input: { displayName: string; email: string; photoURL?: string | null },
): Promise<void> {
  const profile: Omit<UserProfile, "id"> = {
    displayName: input.displayName,
    email: input.email,
    photoURL: input.photoURL ?? null,
    currency: "INR",
    dateFormat: "dd MMM yyyy",
    monthStartDay: 1,
    defaultAccountId: null,
    onboardingCompleted: false,
    theme: "system",
    widgets: DEFAULT_WIDGETS,
    notifications: DEFAULT_NOTIFICATIONS,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await setDoc(userDoc(uid), { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await seedDefaultCategories(uid);
}

export async function updateUserProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await updateDoc(userDoc(uid), stripUndefined({ ...patch, updatedAt: serverTimestamp() }));
}

export async function seedDefaultCategories(uid: string): Promise<void> {
  const existing = await getDocs(col(uid, "categories"));
  if (!existing.empty) return;

  const batch = writeBatch(getDb());
  const stamp = nowIso();

  const writeTree = (
    seeds: typeof DEFAULT_EXPENSE_CATEGORIES | typeof DEFAULT_INCOME_CATEGORIES,
  ) => {
    for (const seed of seeds) {
      const parentRef = doc(col(uid, "categories"));
      batch.set(parentRef, {
        name: seed.name,
        kind: seed.kind,
        parentId: null,
        icon: seed.icon,
        color: seed.color,
        isDefault: true,
        createdAt: stamp,
        updatedAt: stamp,
      });
      for (const child of seed.children ?? []) {
        const childRef = doc(col(uid, "categories"));
        batch.set(childRef, {
          name: child.name,
          kind: seed.kind,
          parentId: parentRef.id,
          icon: child.icon,
          color: child.color,
          isDefault: true,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }
  };

  writeTree(DEFAULT_EXPENSE_CATEGORIES);
  writeTree(DEFAULT_INCOME_CATEGORIES);
  await batch.commit();
}

export async function createAccount(
  uid: string,
  input: Omit<Account, "id" | "createdAt" | "updatedAt" | "currentBalance" | "outstanding" | "archived">,
): Promise<string> {
  const isCredit = input.kind === "credit";
  const payload = stripUndefined({
    ...input,
    archived: false,
    currentBalance: isCredit ? 0 : input.openingBalance,
    outstanding: isCredit ? input.openingOutstanding : 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const ref = await addDoc(col(uid, "accounts"), payload);
  return ref.id;
}
