"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  activityQuantity,
  isRatePriced,
  occurrenceAmount,
  usesQuantity,
} from "@/lib/finance/activity-calculations";
import type { Activity, ActivityCheckStatus, ActivityRecord, CurrencyCode } from "@/types";

type StoredStatus = Exclude<ActivityCheckStatus, "pending" | "missed">;

function activityDraft(
  activity: Activity,
  patch: Pick<Activity, "amount" | "defaultQuantity">,
): Omit<Activity, "id" | "createdAt" | "updatedAt"> {
  return {
    name: activity.name,
    group: activity.group,
    categoryId: activity.categoryId,
    expenseCategoryId: activity.expenseCategoryId,
    providerId: activity.providerId,
    icon: activity.icon,
    color: activity.color,
    description: activity.description,
    providerName: activity.providerName,
    providerPhone: activity.providerPhone,
    providerNotes: activity.providerNotes,
    pricingType: activity.pricingType,
    amount: patch.amount,
    unit: activity.unit,
    defaultQuantity: patch.defaultQuantity,
    frequency: activity.frequency,
    activeDays: activity.activeDays,
    startDate: activity.startDate,
    endDate: activity.endDate,
    status: activity.status,
    pauses: activity.pauses,
    autoCreateExpense: activity.autoCreateExpense,
    autoSettle: activity.autoSettle,
    defaultAccountId: activity.defaultAccountId,
    notes: activity.notes,
  };
}

export async function saveDailyCheckAmount(
  activity: Activity,
  date: string,
  quantity: number,
  amount: number,
  actions: {
    saveActivity: (input: Omit<Activity, "id" | "createdAt" | "updatedAt">, id?: string) => Promise<string>;
    checkIn: (input: {
      activityId: string;
      date?: string;
      status: StoredStatus;
      quantity?: number;
      amount?: number;
    }) => Promise<void>;
  },
) {
  const qty = quantity > 0 ? quantity : activityQuantity(activity);
  if (isRatePriced(activity)) {
    if (amount !== activity.amount || qty !== activity.defaultQuantity) {
      await actions.saveActivity(activityDraft(activity, { amount, defaultQuantity: qty }), activity.id);
    }
    await actions.checkIn({
      activityId: activity.id,
      date,
      status: "completed",
      quantity: qty,
    });
    return;
  }
  await actions.checkIn({
    activityId: activity.id,
    date,
    status: "completed",
    quantity: qty,
    amount,
  });
}

function startingAmount(activity: Activity, record: ActivityRecord | undefined, quantity: number): number {
  if (isRatePriced(activity)) return activity.amount;
  if (record?.status === "completed" && typeof record.amountOverride === "number") return record.amountOverride;
  if (record?.status === "completed" && record.calculatedAmount > 0) return record.calculatedAmount;
  return occurrenceAmount(activity, quantity);
}

export function CheckAmountDialog({
  open,
  onOpenChange,
  activity,
  date,
  currency,
  record,
  onSave,
  onStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | undefined;
  date: string | null;
  currency: CurrencyCode;
  record?: ActivityRecord;
  onSave: (values: { quantity: number; amount: number }) => Promise<void>;
  onStatus?: (status: Exclude<StoredStatus, "completed">) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activity && date ? `${activity.name} · ${format(parseISO(date), "d MMM")}` : "Edit check"}
          </DialogTitle>
        </DialogHeader>
        {activity && date ? (
          <CheckAmountForm
            key={`${activity.id}-${date}-${record?.updatedAt ?? "new"}`}
            activity={activity}
            currency={currency}
            record={record}
            onSave={onSave}
            onStatus={onStatus}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CheckAmountForm({
  activity,
  currency,
  record,
  onSave,
  onStatus,
}: {
  activity: Activity;
  currency: CurrencyCode;
  record?: ActivityRecord;
  onSave: (values: { quantity: number; amount: number }) => Promise<void>;
  onStatus?: (status: Exclude<StoredStatus, "completed">) => Promise<void>;
}) {
  const quantityBased = usesQuantity(activity);
  const ratePriced = isRatePriced(activity);
  const [quantity, setQuantity] = useState(record?.quantity ?? activity.defaultQuantity ?? 1);
  const [amount, setAmount] = useState(startingAmount(activity, record, record?.quantity ?? activity.defaultQuantity ?? 1));
  const [saving, setSaving] = useState(false);
  const invalid = (quantityBased && !(quantity > 0)) || (ratePriced ? !(amount > 0) : !(amount >= 0));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {ratePriced
          ? "Amount updates the activity rate. Quantity is saved on this day."
          : "This is saved on this day's record. Changing quantity recalculates the amount from the unit price."}
      </p>
      {quantityBased ? (
        <Field label="Quantity">
          <Input
            type="number"
            min={0.01}
            step="any"
            value={Number.isFinite(quantity) ? quantity : ""}
            onChange={(event) => {
              const next = Number(event.target.value);
              setQuantity(next);
              if (!ratePriced && Number.isFinite(next) && next > 0) {
                setAmount(occurrenceAmount(activity, next));
              }
            }}
          />
        </Field>
      ) : null}
      <Field label={ratePriced ? "Rate" : "Amount"}>
        <MoneyInput currency={currency} value={amount} onChange={setAmount} />
      </Field>
      <Button
        className="w-full"
        disabled={invalid || saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({ quantity, amount });
          } finally {
            setSaving(false);
          }
        }}
      >
        {record?.status === "completed" ? "Save" : "Save and complete"}
      </Button>
      {onStatus ? (
        <div className="flex flex-wrap gap-2">
          {(["skipped", "cancelled", "not_applicable"] as const).map((status) => (
            <Button key={status} variant="outline" size="sm" onClick={() => onStatus(status)}>
              {status.replace("_", " ")}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
