"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERSON_RELATIONSHIPS, UDHAR_INTEREST_TYPES, UDHAR_TYPES } from "@/constants/people";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLabel } from "@/lib/finance/account-label";
import { computeInterest } from "@/lib/finance/udhar";
import { getErrorMessage } from "@/lib/firebase/errors";
import { todayISO } from "@/lib/utils/dates";
import { udharSchema, type UdharValues } from "@/lib/validations";
import { uploadUserFile } from "@/services/storage";
import type { Attachment, UdharType } from "@/types";

export function UdharForm({
  type,
  personId,
  onDone,
  showTypePicker = true,
}: {
  type?: UdharType;
  personId?: string;
  onDone?: () => void;
  showTypePicker?: boolean;
}) {
  const { user, profile } = useAuth();
  const { people, accounts, saveUdhar } = useFinance();
  const currency = profile?.currency ?? "INR";
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const form = useForm<UdharValues>({
    resolver: zodResolver(udharSchema),
    defaultValues: {
      personId: personId ?? "",
      newPersonName: "",
      newPersonPhone: "",
      newPersonRelationship: "friend",
      type: type ?? "lent",
      principalAmount: 0,
      date: todayISO(),
      dueDate: "",
      noDueDate: true,
      accountId: profile?.defaultAccountId ?? accounts.find((item) => item.kind !== "credit" && !item.archived)?.id ?? "",
      interestType: "none",
      interestAmount: 0,
      interestRate: 0,
      notes: "",
      reminderDays: profile?.udharReminderDays ?? 1,
      remindInDailyCheck: false,
    },
  });

  const watchType = form.watch("type");
  const watchPerson = form.watch("personId");
  const isNew = watchPerson === "__new__" || (!watchPerson && !personId);
  const noDueDate = form.watch("noDueDate");
  const interestType = form.watch("interestType");
  const principal = form.watch("principalAmount");
  const breakdown = computeInterest(
    principal,
    interestType,
    form.watch("interestAmount"),
    form.watch("interestRate"),
  );
  const moneyAccounts = accounts.filter((item) => !item.archived && item.kind !== "investment");

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await saveUdhar({
            personId: values.personId && values.personId !== "__new__" ? values.personId : undefined,
            newPersonName: values.personId === "__new__" || !values.personId ? values.newPersonName : undefined,
            newPersonPhone: values.newPersonPhone,
            newPersonRelationship: values.newPersonRelationship,
            type: values.type,
            principalAmount: values.principalAmount,
            date: values.date,
            dueDate: values.noDueDate ? null : values.dueDate || null,
            accountId: values.accountId,
            interestType: values.interestType,
            interestAmount: values.interestAmount,
            interestRate: values.interestRate,
            notes: values.notes,
            reminderDays: values.reminderDays,
            remindInDailyCheck: values.remindInDailyCheck,
            attachments,
          });
          toast.success(values.type === "lent" ? "Lending saved" : "Borrowing saved");
          onDone?.();
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      })}
    >
      {showTypePicker ? (
        <RadioGroup
          value={watchType}
          onValueChange={(value) => form.setValue("type", value as UdharType)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {UDHAR_TYPES.map((item) => (
            <Label
              key={item.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 has-data-checked:border-foreground"
            >
              <RadioGroupItem value={item.value} />
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      ) : (
        <p className="text-sm text-muted-foreground">
          {watchType === "lent" ? "Someone owes me money." : "I owe someone money."}
        </p>
      )}

      {!personId ? (
        <Field label="Person" error={form.formState.errors.personId?.message}>
          <Select
            value={watchPerson || "__new__"}
            onValueChange={(value) => form.setValue("personId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose someone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">Someone new</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {isNew && !personId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" error={form.formState.errors.newPersonName?.message} className="sm:col-span-2">
            <Input {...form.register("newPersonName")} placeholder="Amit" />
          </Field>
          <Field label="Phone">
            <Input {...form.register("newPersonPhone")} placeholder="Optional" />
          </Field>
          <Field label="Relationship">
            <Select
              value={form.watch("newPersonRelationship") ?? "friend"}
              onValueChange={(value) =>
                form.setValue("newPersonRelationship", value as UdharValues["newPersonRelationship"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSON_RELATIONSHIPS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : null}

      <Field label="Amount" error={form.formState.errors.principalAmount?.message}>
        <MoneyInput
          currency={currency}
          value={principal}
          onChange={(value) => form.setValue("principalAmount", value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input type="date" {...form.register("date")} />
        </Field>
        <Field label={watchType === "lent" ? "Paid from" : "Received into"} error={form.formState.errors.accountId?.message}>
          <Select value={form.watch("accountId")} onValueChange={(value) => form.setValue("accountId", value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {moneyAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <div>
          <p className="text-sm font-medium">No fixed due date</p>
          <p className="text-xs text-muted-foreground">They’ll return whenever possible.</p>
        </div>
        <Switch checked={noDueDate} onCheckedChange={(checked) => form.setValue("noDueDate", checked)} />
      </div>
      {!noDueDate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Due date">
            <Input type="date" {...form.register("dueDate")} />
          </Field>
          <Field label="Remind me">
            <Select
              value={String(form.watch("reminderDays") ?? 1)}
              onValueChange={(value) => form.setValue("reminderDays", Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">On the due date</SelectItem>
                <SelectItem value="1">1 day before</SelectItem>
                <SelectItem value="3">3 days before</SelectItem>
                <SelectItem value="7">7 days before</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ) : null}

      <Field label="Interest">
        <Select
          value={interestType}
          onValueChange={(value) => form.setValue("interestType", value as UdharValues["interestType"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UDHAR_INTEREST_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {interestType === "fixed" ? (
        <Field label="Interest amount" error={form.formState.errors.interestAmount?.message}>
          <MoneyInput
            currency={currency}
            value={form.watch("interestAmount") ?? 0}
            onChange={(value) => form.setValue("interestAmount", value)}
          />
        </Field>
      ) : null}
      {interestType === "percentage" ? (
        <Field label="Interest %" error={form.formState.errors.interestRate?.message}>
          <Input type="number" step="0.1" {...form.register("interestRate", { valueAsNumber: true })} />
        </Field>
      ) : null}
      {interestType !== "none" ? (
        <p className="text-xs text-muted-foreground">
          Principal stays separate. Total due is {breakdown.totalAmount.toLocaleString("en-IN")} (interest{" "}
          {breakdown.interestAmount.toLocaleString("en-IN")}).
        </p>
      ) : null}

      <Field label="Notes">
        <Textarea rows={3} {...form.register("notes")} placeholder="Emergency loan for car repair." />
      </Field>
      <Field label="Attachment">
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !user) return;
            try {
              const uploaded = await uploadUserFile(user.uid, file, "udhar");
              setAttachments((current) => [...current, uploaded]);
              toast.success("Attachment added");
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        />
        {attachments.length ? (
          <p className="text-xs text-muted-foreground">{attachments.map((item) => item.name).join(", ")}</p>
        ) : null}
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <div>
          <p className="text-sm font-medium">Show in Daily Check</p>
          <p className="text-xs text-muted-foreground">Optional follow-up when this is due.</p>
        </div>
        <Switch
          checked={form.watch("remindInDailyCheck") ?? false}
          onCheckedChange={(checked) => form.setValue("remindInDailyCheck", checked)}
        />
      </div>
      <Button className="w-full" type="submit" disabled={!moneyAccounts.length}>
        Save
      </Button>
    </form>
  );
}
