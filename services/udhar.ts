import { doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { applyDeltas, invertDeltas, transactionDeltas } from "@/lib/finance/calculations";
import { roundMoney } from "@/lib/finance/money";
import {
  allocatePayment,
  computeInterest,
  deriveUdharStatus,
  fifoTargets,
  isOpenUdhar,
  liveUdhar,
  liveUdhars,
  planNetSettlement,
  UDHAR_TO_TX_METHOD,
} from "@/lib/finance/udhar";
import { col, nowIso, stripUndefined } from "@/services/helpers";
import { addDocAt, createTransaction, deleteDocAt, updateDocAt, type TransactionInput } from "@/services/transactions";
import type {
  Account,
  Attachment,
  Category,
  Person,
  PersonNote,
  PersonRelationship,
  Udhar,
  UdharPaymentMethod,
  UdharRepayment,
  UdharType,
} from "@/types";

type PersonInput = Omit<Person, "id" | "createdAt" | "updatedAt">;
type UdharCreateInput = {
  personId: string;
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
  attachments?: Attachment[];
};

function interestCategoryId(categories: Category[], kind: "income" | "expense") {
  return (
    categories.find((item) => item.kind === kind && item.name.toLowerCase() === "interest")?.id ?? null
  );
}

function accountsMap(accounts: Account[]) {
  return new Map(accounts.map((account) => [account.id, account]));
}

export async function savePerson(uid: string, input: PersonInput, id?: string) {
  if (id) {
    await updateDocAt(uid, "people", id, input);
    return id;
  }
  return addDocAt(uid, "people", input);
}

export async function createPersonInline(
  uid: string,
  input: { name: string; phone?: string; relationship?: PersonRelationship; notes?: string },
) {
  return addDocAt(uid, "people", {
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    relationship: input.relationship ?? "other",
    notes: input.notes,
  });
}

export async function removePerson(uid: string, id: string, udhars: Udhar[]) {
  if (udhars.some((item) => item.personId === id && item.status !== "cancelled" && item.status !== "settled")) {
    throw new Error("Settle or cancel open udhar with this person first");
  }
  await deleteDocAt(uid, "people", id);
}

function udharPayload(input: UdharCreateInput): Omit<Udhar, "id" | "createdAt" | "updatedAt" | "transactionId"> {
  const interest = computeInterest(
    input.principalAmount,
    input.interestType,
    input.interestAmount,
    input.interestRate,
  );
  return {
    personId: input.personId,
    type: input.type,
    principalAmount: roundMoney(input.principalAmount),
    outstandingPrincipal: roundMoney(input.principalAmount),
    interestType: input.interestType,
    interestRate: input.interestType === "percentage" ? input.interestRate : undefined,
    interestAmount: interest.interestAmount,
    outstandingInterest: interest.interestAmount,
    totalAmount: interest.totalAmount,
    outstandingAmount: interest.totalAmount,
    date: input.date,
    dueDate: input.dueDate || null,
    status: "active",
    accountId: input.accountId,
    notes: input.notes,
    reminderDays: input.reminderDays,
    remindInDailyCheck: input.remindInDailyCheck ?? false,
    attachments: input.attachments ?? [],
  };
}

export async function createUdhar(
  uid: string,
  accounts: Account[],
  person: Person,
  input: UdharCreateInput,
): Promise<string> {
  const payload = udharPayload(input);
  const udharRef = doc(col(uid, "udhar"));
  const lent = input.type === "lent";
  await createTransaction(
    uid,
    accounts,
    {
      type: "udhar",
      amount: payload.principalAmount,
      categoryId: null,
      accountId: input.accountId,
      fromAccountId: null,
      toAccountId: null,
      date: input.date,
      description: lent ? `Lent to ${person.name}` : `Borrowed from ${person.name}`,
      notes: input.notes,
      tags: ["udhar"],
      attachments: input.attachments ?? [],
      isCreditCardPayment: false,
      status: "cleared",
      udharId: udharRef.id,
      personId: person.id,
      udharKind: lent ? "lent" : "borrowed",
      principalAmount: payload.principalAmount,
      interestAmount: 0,
    },
    {
      additional: (batch, txId) => {
        batch.set(
          udharRef,
          stripUndefined({
            ...payload,
            transactionId: txId,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }),
        );
      },
    },
  );
  return udharRef.id;
}

type RepaymentInput = {
  amount: number;
  accountId: string;
  paymentDate: string;
  paymentMethod: UdharPaymentMethod;
  notes?: string;
  attachments?: Attachment[];
  isNetOffset?: boolean;
};

async function applyRepayments(input: {
  uid: string;
  accounts: Account[];
  categories: Category[];
  person: Person;
  allocations: { udhar: Udhar; amount: number; principalAmount: number; interestAmount: number }[];
  repayment: RepaymentInput;
}) {
  let working = input.accounts;
  for (const allocation of input.allocations) {
    if (allocation.amount <= 0) continue;
    const received = allocation.udhar.type === "lent";
    const nextOutstandingPrincipal = roundMoney(
      Math.max(0, allocation.udhar.outstandingPrincipal - allocation.principalAmount),
    );
    const nextOutstandingInterest = roundMoney(
      Math.max(0, allocation.udhar.outstandingInterest - allocation.interestAmount),
    );
    const nextOutstanding = roundMoney(nextOutstandingPrincipal + nextOutstandingInterest);
    const nextStatus = deriveUdharStatus({
      ...allocation.udhar,
      outstandingAmount: nextOutstanding,
    });
    const repaymentRef = doc(col(input.uid, "udharRepayments"));
    const repaymentDoc: Omit<UdharRepayment, "id"> = {
      udharId: allocation.udhar.id,
      personId: input.person.id,
      amount: allocation.amount,
      principalAmount: allocation.principalAmount,
      interestAmount: allocation.interestAmount,
      accountId: input.repayment.isNetOffset ? allocation.udhar.accountId : input.repayment.accountId,
      paymentDate: input.repayment.paymentDate,
      paymentMethod: input.repayment.paymentMethod,
      notes: input.repayment.notes,
      attachments: input.repayment.attachments ?? [],
      isNetOffset: input.repayment.isNetOffset ?? false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    if (input.repayment.isNetOffset) {
      const batch = writeBatch(getDb());
      batch.set(repaymentRef, stripUndefined(repaymentDoc));
      batch.update(
        doc(getDb(), "users", input.uid, "udhar", allocation.udhar.id),
        stripUndefined({
          outstandingPrincipal: nextOutstandingPrincipal,
          outstandingInterest: nextOutstandingInterest,
          outstandingAmount: nextOutstanding,
          status: nextStatus,
          updatedAt: nowIso(),
        }),
      );
      await batch.commit();
      continue;
    }

    const categoryId =
      allocation.interestAmount > 0
        ? interestCategoryId(input.categories, received ? "income" : "expense")
        : null;
    await createTransaction(
      input.uid,
      working,
      {
        type: "udhar",
        amount: allocation.amount,
        categoryId,
        accountId: input.repayment.accountId,
        fromAccountId: null,
        toAccountId: null,
        date: input.repayment.paymentDate,
        description: received ? `Payment from ${input.person.name}` : `Paid ${input.person.name}`,
        notes: input.repayment.notes,
        paymentMethod: UDHAR_TO_TX_METHOD[input.repayment.paymentMethod],
        tags: ["udhar"],
        attachments: input.repayment.attachments ?? [],
        isCreditCardPayment: false,
        status: "cleared",
        udharId: allocation.udhar.id,
        personId: input.person.id,
        repaymentId: repaymentRef.id,
        udharKind: received ? "repayment_received" : "repayment_made",
        principalAmount: allocation.principalAmount,
        interestAmount: allocation.interestAmount,
      },
      {
        additional: (batch, txId) => {
          batch.set(repaymentRef, stripUndefined({ ...repaymentDoc, transactionId: txId }));
          batch.update(
            doc(getDb(), "users", input.uid, "udhar", allocation.udhar.id),
            stripUndefined({
              outstandingPrincipal: nextOutstandingPrincipal,
              outstandingInterest: nextOutstandingInterest,
              outstandingAmount: nextOutstanding,
              status: nextStatus,
              updatedAt: nowIso(),
            }),
          );
        },
      },
    );
    const tx: TransactionInput = {
      type: "udhar",
      amount: allocation.amount,
      categoryId,
      accountId: input.repayment.accountId,
      fromAccountId: null,
      toAccountId: null,
      date: input.repayment.paymentDate,
      description: "",
      tags: [],
      isCreditCardPayment: false,
      status: "cleared",
      udharId: allocation.udhar.id,
      udharKind: received ? "repayment_received" : "repayment_made",
    };
    working = applyDeltas(working, transactionDeltas(tx, accountsMap(working)));
  }
}

export async function recordUdharRepayment(input: {
  uid: string;
  accounts: Account[];
  categories: Category[];
  person: Person;
  udhar: Udhar;
  repayments: UdharRepayment[];
  repayment: RepaymentInput;
}) {
  const live = liveUdhar(input.udhar, input.repayments);
  if (!isOpenUdhar(live)) throw new Error("Nothing is outstanding on this record");
  const amount = roundMoney(input.repayment.amount);
  if (amount > live.outstandingAmount) {
    throw new Error("Amount is more than what is still outstanding");
  }
  const split = allocatePayment(live.outstandingPrincipal, live.outstandingInterest, amount);
  await applyRepayments({
    uid: input.uid,
    accounts: input.accounts,
    categories: input.categories,
    person: input.person,
    allocations: [{ udhar: live, amount, ...split }],
    repayment: input.repayment,
  });
}

export async function recordPersonRepayment(input: {
  uid: string;
  accounts: Account[];
  categories: Category[];
  person: Person;
  udhars: Udhar[];
  repayments: UdharRepayment[];
  type: UdharType;
  repayment: RepaymentInput;
}) {
  const live = liveUdhars(input.udhars, input.repayments).filter(
    (item) => item.personId === input.person.id && item.type === input.type && isOpenUdhar(item),
  );
  const { allocations, leftover } = fifoTargets(live, input.repayment.amount);
  if (!allocations.length) throw new Error("Nothing is outstanding");
  if (leftover > 0) throw new Error("Amount is more than what is still outstanding");
  await applyRepayments({
    uid: input.uid,
    accounts: input.accounts,
    categories: input.categories,
    person: input.person,
    allocations,
    repayment: input.repayment,
  });
}

export async function settleUdhar(input: {
  uid: string;
  accounts: Account[];
  categories: Category[];
  person: Person;
  udhar: Udhar;
  repayments: UdharRepayment[];
  accountId: string;
  paymentDate: string;
  paymentMethod: UdharPaymentMethod;
  notes?: string;
}) {
  const live = liveUdhar(input.udhar, input.repayments);
  if (!isOpenUdhar(live)) throw new Error("Already settled");
  await recordUdharRepayment({
    ...input,
    repayment: {
      amount: live.outstandingAmount,
      accountId: input.accountId,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? "Settled in full",
    },
  });
}

export async function settlePersonNet(input: {
  uid: string;
  accounts: Account[];
  categories: Category[];
  person: Person;
  udhars: Udhar[];
  repayments: UdharRepayment[];
  accountId: string;
  paymentDate: string;
  paymentMethod: UdharPaymentMethod;
  notes?: string;
}) {
  const live = liveUdhars(input.udhars, input.repayments).filter((item) => item.personId === input.person.id);
  const plan = planNetSettlement(live);
  if (plan.overlap <= 0 && Math.abs(plan.net) <= 0) throw new Error("Nothing to settle");

  if (plan.offsets.length) {
    await applyRepayments({
      uid: input.uid,
      accounts: input.accounts,
      categories: input.categories,
      person: input.person,
      allocations: plan.offsets,
      repayment: {
        amount: plan.overlap,
        accountId: input.accountId,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? "Net settlement offset",
        isNetOffset: true,
      },
    });
  }

  if (plan.cashAllocations.length && Math.abs(plan.net) > 0) {
    await applyRepayments({
      uid: input.uid,
      accounts: input.accounts,
      categories: input.categories,
      person: input.person,
      allocations: plan.cashAllocations,
      repayment: {
        amount: Math.abs(plan.net),
        accountId: input.accountId,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? "Settled net amount",
      },
    });
  }
}

export async function cancelUdhar(uid: string, udhar: Udhar) {
  await updateDocAt(uid, "udhar", udhar.id, {
    status: "cancelled",
    outstandingPrincipal: 0,
    outstandingInterest: 0,
    outstandingAmount: 0,
  });
}

export async function dismissUdharFollowUp(uid: string, udharId: string, date: string) {
  await updateDocAt(uid, "udhar", udharId, { followUpDoneOn: date });
}

export async function addPersonNote(
  uid: string,
  input: Omit<PersonNote, "id" | "createdAt" | "updatedAt">,
) {
  return addDocAt(uid, "peopleNotes", input);
}

export async function removePersonNote(uid: string, id: string) {
  await deleteDocAt(uid, "peopleNotes", id);
}

export async function removeUdhar(
  uid: string,
  accounts: Account[],
  udhar: Udhar,
  repayments: UdharRepayment[],
  transactions: { id: string }[],
) {
  const relatedRepayments = repayments.filter((item) => item.udharId === udhar.id);
  const relatedTxIds = [
    udhar.transactionId,
    ...relatedRepayments.map((item) => item.transactionId),
  ].filter((id): id is string => Boolean(id));

  const snaps = relatedTxIds.length
    ? await getDocs(query(col(uid, "transactions"), where("udharId", "==", udhar.id)))
    : { docs: [] as { id: string; data: () => Record<string, unknown> }[] };

  const batch = writeBatch(getDb());
  let working = accounts;
  for (const snap of snaps.docs) {
    const tx = { id: snap.id, ...snap.data() } as Parameters<typeof transactionDeltas>[0] & { id: string };
    const reverse = invertDeltas(transactionDeltas(tx, accountsMap(working)));
    working = applyDeltas(working, reverse);
    const changed = new Set(reverse.map((delta) => delta.accountId));
    for (const account of working) {
      if (!changed.has(account.id)) continue;
      batch.update(doc(getDb(), "users", uid, "accounts", account.id), {
        currentBalance: account.currentBalance,
        outstanding: account.outstanding,
        updatedAt: nowIso(),
      });
    }
    batch.delete(doc(getDb(), "users", uid, "transactions", snap.id));
  }
  for (const repayment of relatedRepayments) {
    batch.delete(doc(getDb(), "users", uid, "udharRepayments", repayment.id));
  }
  batch.delete(doc(getDb(), "users", uid, "udhar", udhar.id));
  await batch.commit();
  void transactions;
}
