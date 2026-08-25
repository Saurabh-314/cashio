"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { ACCOUNT_COLORS } from "@/constants/categories";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountSchema, type AccountValues } from "@/lib/validations";
import type { Account, AccountKind } from "@/types";

export function AccountForm({
  initial,
  defaultKind,
  onDone,
}: {
  initial?: Account;
  defaultKind?: AccountKind;
  onDone?: () => void;
}) {
  const { profile } = useAuth();
  const { saveAccount } = useFinance();
  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initial?.name ?? "",
      kind: initial?.kind ?? defaultKind ?? "bank",
      bankName: initial?.bankName ?? "",
      bankAccountType: initial?.bankAccountType ?? "savings",
      last4: initial?.last4 ?? "",
      openingBalance: initial?.openingBalance ?? 0,
      openingOutstanding: initial?.openingOutstanding ?? 0,
      creditLimit: initial?.creditLimit ?? 0,
      billingDay: initial?.billingDay ?? 1,
      paymentDueDay: initial?.paymentDueDay ?? 10,
      interestRate: initial?.interestRate ?? 0,
      color: initial?.color ?? ACCOUNT_COLORS[0],
      icon: initial?.icon ?? "wallet",
      notes: initial?.notes ?? "",
    },
  });
  const kind = form.watch("kind");

  async function onSubmit(values: AccountValues) {
    await saveAccount(
      {
        name: values.name,
        kind: values.kind,
        bankName: values.bankName,
        bankAccountType: values.bankAccountType,
        last4: values.last4,
        openingBalance: values.kind === "credit" ? 0 : values.openingBalance,
        openingOutstanding: values.kind === "credit" ? (values.openingOutstanding ?? 0) : 0,
        creditLimit: values.creditLimit,
        billingDay: values.billingDay,
        paymentDueDay: values.paymentDueDay,
        interestRate: values.interestRate,
        color: values.color,
        icon: values.icon,
        notes: values.notes,
        currency: profile?.currency ?? "INR",
      },
      initial?.id,
    );
    onDone?.();
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="HDFC Savings" />
        </Field>
        <Field label="Type">
          <Select value={kind} onValueChange={(value) => form.setValue("kind", value as AccountKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit card</SelectItem>
              <SelectItem value="other_asset">Other asset</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {kind === "bank" || kind === "credit" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank">
            <Input {...form.register("bankName")} placeholder="HDFC" />
          </Field>
          <Field label="Last 4 digits">
            <Input maxLength={4} {...form.register("last4")} placeholder="1234" />
          </Field>
        </div>
      ) : null}
      {kind === "bank" ? (
        <Field label="Account type">
          <Select
            value={form.watch("bankAccountType")}
            onValueChange={(value) =>
              form.setValue("bankAccountType", value as AccountValues["bankAccountType"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {kind === "credit" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Credit limit">
              <MoneyInput
                currency={profile?.currency ?? "INR"}
                value={form.watch("creditLimit") ?? 0}
                onChange={(value) => form.setValue("creditLimit", value)}
              />
            </Field>
            <Field label="Current outstanding">
              <MoneyInput
                currency={profile?.currency ?? "INR"}
                value={form.watch("openingOutstanding") ?? 0}
                onChange={(value) => form.setValue("openingOutstanding", value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Billing day">
              <Input type="number" min={1} max={31} {...form.register("billingDay", { valueAsNumber: true })} />
            </Field>
            <Field label="Due day">
              <Input type="number" min={1} max={31} {...form.register("paymentDueDay", { valueAsNumber: true })} />
            </Field>
            <Field label="Interest %">
              <Input type="number" step="0.1" {...form.register("interestRate", { valueAsNumber: true })} />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Opening balance">
          <MoneyInput
            currency={profile?.currency ?? "INR"}
            value={form.watch("openingBalance")}
            onChange={(value) => form.setValue("openingBalance", value)}
          />
        </Field>
      )}
      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => form.setValue("color", color)}
              className="size-7 rounded-full ring-offset-2"
              style={{
                background: color,
                boxShadow: form.watch("color") === color ? `0 0 0 2px ${color}` : undefined,
              }}
            />
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <Textarea rows={3} {...form.register("notes")} />
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : initial ? "Update account" : "Create account"}
      </Button>
    </form>
  );
}
