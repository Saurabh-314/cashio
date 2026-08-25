import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { applyDeltas, invertDeltas, transactionDeltas } from "@/lib/finance/calculations";
import { col, nowIso, stripUndefined } from "@/services/helpers";
import type { Account, Attachment, Transaction } from "@/types";

export type TransactionInput = Omit<Transaction, "id" | "createdAt" | "updatedAt" | "attachments"> & {
  attachments?: Attachment[];
};

function accountsById(accounts: Account[]) {
  return new Map(accounts.map((account) => [account.id, account]));
}

function applyAccountUpdates(
  uid: string,
  accounts: Account[],
  deltas: ReturnType<typeof transactionDeltas>,
) {
  const batch = writeBatch(getDb());
  const next = applyDeltas(accounts, deltas);
  const changed = new Set(deltas.map((delta) => delta.accountId));
  for (const account of next) {
    if (!changed.has(account.id)) continue;
    batch.update(doc(getDb(), "users", uid, "accounts", account.id), {
      currentBalance: account.currentBalance,
      outstanding: account.outstanding,
      updatedAt: nowIso(),
    });
  }
  return { batch, next };
}

export async function createTransaction(
  uid: string,
  accounts: Account[],
  input: TransactionInput,
  extras?: { loanRemainingDelta?: number; goalDelta?: number; goalId?: string; loanId?: string },
): Promise<string> {
  const to = accounts.find((account) => account.id === input.toAccountId);
  const payload = stripUndefined({
    ...input,
    attachments: input.attachments ?? [],
    isCreditCardPayment: input.type === "transfer" && to?.kind === "credit",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const deltas = transactionDeltas(payload as Transaction, accountsById(accounts));
  const { batch } = applyAccountUpdates(uid, accounts, deltas);
  const txRef = doc(col(uid, "transactions"));
  batch.set(txRef, payload);

  if (extras?.loanId && extras.loanRemainingDelta) {
    const loan = doc(getDb(), "users", uid, "loans", extras.loanId);
    batch.update(loan, {
      remainingAmount: extras.loanRemainingDelta,
      updatedAt: nowIso(),
    });
  }
  if (extras?.goalId && extras.goalDelta) {
    const goal = doc(getDb(), "users", uid, "goals", extras.goalId);
    batch.update(goal, {
      currentAmount: extras.goalDelta,
      updatedAt: nowIso(),
    });
  }

  await batch.commit();
  return txRef.id;
}

export async function updateTransaction(
  uid: string,
  accounts: Account[],
  previous: Transaction,
  nextInput: TransactionInput,
): Promise<void> {
  const map = accountsById(accounts);
  const reverse = invertDeltas(transactionDeltas(previous, map));
  const afterReverse = applyDeltas(accounts, reverse);
  const forward = transactionDeltas(nextInput as Transaction, accountsById(afterReverse));
  const combined = [...reverse, ...forward];
  const { batch } = applyAccountUpdates(uid, accounts, combined);
  batch.update(
    doc(getDb(), "users", uid, "transactions", previous.id),
    stripUndefined({ ...nextInput, updatedAt: nowIso() }),
  );
  await batch.commit();
}

export async function deleteTransaction(
  uid: string,
  accounts: Account[],
  transaction: Transaction,
): Promise<void> {
  const reverse = invertDeltas(transactionDeltas(transaction, accountsById(accounts)));
  const { batch } = applyAccountUpdates(uid, accounts, reverse);
  batch.delete(doc(getDb(), "users", uid, "transactions", transaction.id));
  await batch.commit();
}

export async function countTransactionsForCategory(uid: string, categoryId: string): Promise<number> {
  const snap = await getDocs(query(col(uid, "transactions"), where("categoryId", "==", categoryId)));
  return snap.size;
}

export async function countTransactionsForAccount(uid: string, accountId: string): Promise<number> {
  const byAccount = await getDocs(query(col(uid, "transactions"), where("accountId", "==", accountId)));
  const from = await getDocs(query(col(uid, "transactions"), where("fromAccountId", "==", accountId)));
  const to = await getDocs(query(col(uid, "transactions"), where("toAccountId", "==", accountId)));
  const ids = new Set([...byAccount.docs, ...from.docs, ...to.docs].map((item) => item.id));
  return ids.size;
}

export async function deleteDocAt(uid: string, collectionName: string, id: string) {
  await deleteDoc(doc(getDb(), "users", uid, collectionName, id));
}

export async function addDocAt<T extends Record<string, unknown>>(
  uid: string,
  collectionName: string,
  data: T,
) {
  const ref = await addDoc(col(uid, collectionName), stripUndefined({ ...data, createdAt: nowIso(), updatedAt: nowIso() }));
  return ref.id;
}

export async function updateDocAt(
  uid: string,
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
) {
  await updateDoc(doc(getDb(), "users", uid, collectionName, id), stripUndefined({ ...data, updatedAt: nowIso() }));
}
