import { doc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  deriveSettlementStatus,
  monthSummary,
  recordAmount,
  recordId,
  remainingDue,
  settlementId,
  activityUnitPrice,
  usesQuantity,
} from "@/lib/finance/activity-calculations";
import { roundMoney } from "@/lib/finance/money";
import { monthKey, todayISO } from "@/lib/utils/dates";
import { nowIso, stripUndefined } from "@/services/helpers";
import type {
  Activity,
  ActivityCheckStatus,
  ActivityPause,
  ActivityRecord,
  ActivitySettlement,
  SkipReason,
} from "@/types";

export type ActivityInput = Omit<Activity, "id" | "createdAt" | "updatedAt">;
export type ProviderInput = Omit<import("@/types").ServiceProvider, "id" | "createdAt" | "updatedAt">;

export function activityRecordId(activityId: string, date: string) {
  return recordId(activityId, date);
}

export async function upsertDocAt(
  uid: string,
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
) {
  await setDoc(
    doc(getDb(), "users", uid, collectionName, id),
    stripUndefined({ ...data, updatedAt: nowIso() }),
    { merge: true },
  );
}

export function buildCheckRecord(input: {
  activity: Activity;
  date: string;
  status: Exclude<ActivityCheckStatus, "pending" | "missed">;
  quantity?: number;
  amount?: number;
  skipReason?: SkipReason;
  notes?: string;
  existing?: ActivityRecord;
}): Omit<ActivityRecord, "id"> {
  const quantity = input.quantity ?? input.existing?.quantity ?? input.activity.defaultQuantity ?? 1;
  const month = input.date.slice(0, 7);
  const amountOverride =
    input.amount !== undefined && Number.isFinite(input.amount)
      ? roundMoney(Math.max(0, input.amount))
      : (input.existing?.amountOverride ?? null);
  const calculatedAmount =
    input.status === "completed"
      ? typeof amountOverride === "number"
        ? amountOverride
        : recordAmount(input.activity, quantity, month)
      : 0;
  const unitPrice =
    usesQuantity(input.activity) && quantity > 0 && typeof amountOverride === "number"
      ? roundMoney(amountOverride / quantity)
      : activityUnitPrice(input.activity);
  return {
    activityId: input.activity.id,
    date: input.date,
    status: input.status,
    quantity,
    unitPrice,
    unit: input.activity.unit,
    calculatedAmount,
    amountOverride,
    skipReason: input.skipReason,
    notes: input.notes,
    createdAt: input.existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
}

export function snapshotSettlement(
  activity: Activity,
  records: ActivityRecord[],
  month: string,
  existing?: ActivitySettlement,
  today = todayISO(),
): Omit<ActivitySettlement, "id"> {
  const summary = monthSummary(activity, records, month, today);
  const paidAmount = existing?.locked ? existing.paidAmount : (existing?.paidAmount ?? 0);
  const amount = existing?.locked ? existing.amount : summary.amount;
  return {
    activityId: activity.id,
    providerId: activity.providerId,
    month,
    expectedDays: summary.expectedDays,
    completedDays: summary.completedDays,
    skippedDays: summary.skippedDays,
    missedDays: summary.missedDays,
    amount,
    paidAmount,
    status: deriveSettlementStatus(amount, paidAmount, month, today),
    transactionIds: existing?.transactionIds ?? [],
    locked: existing?.locked ?? false,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
}

export function applySettlementPayment(
  settlement: ActivitySettlement,
  payAmount: number,
  transactionId?: string,
): Omit<ActivitySettlement, "id"> {
  const paidAmount = roundMoney(settlement.paidAmount + payAmount);
    const transactionIds = transactionId
      ? [...(settlement.transactionIds ?? []), transactionId]
      : (settlement.transactionIds ?? []);
  const status = deriveSettlementStatus(settlement.amount, paidAmount, settlement.month);
  return {
    ...settlement,
    paidAmount,
    transactionIds,
    status,
    locked: true,
    updatedAt: nowIso(),
  };
}

export { remainingDue, settlementId, monthKey };
