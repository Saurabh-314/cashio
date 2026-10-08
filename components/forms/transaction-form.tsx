"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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
import { CategorySelect } from "@/components/forms/category-select";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountBalance, accountLabel } from "@/lib/finance/account-label";
import { formatMoney } from "@/lib/finance/money";
import { todayISO } from "@/lib/utils/dates";
import { transactionSchema, type TransactionValues } from "@/lib/validations";
import { uploadReceipt } from "@/services/storage";
import type { Attachment, Transaction } from "@/types";

type FormType = TransactionValues["type"];

export function TransactionForm({
  type,
  initial,
  onDone,
  submitLabel = "Save",
}: {
  type?: FormType;
  initial?: Transaction;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const { user, profile } = useAuth();
  const { accounts, categories, saveTransaction } = useFinance();
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? []);
  const initialType: FormType =
    initial?.type === "income" || initial?.type === "expense" || initial?.type === "transfer"
      ? initial.type
      : (type ?? "expense");
  const form = useForm<TransactionValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: initialType,
      amount: initial?.amount ?? 0,
      date: initial?.date ?? todayISO(),
      description: initial?.description ?? "",
      notes: initial?.notes ?? "",
      merchant: initial?.merchant ?? "",
      categoryId: initial?.categoryId ?? "",
      accountId: initial?.accountId ?? profile?.defaultAccountId ?? "",
      fromAccountId: initial?.fromAccountId ?? "",
      toAccountId: initial?.toAccountId ?? "",
      paymentMethod: initial?.paymentMethod,
      tags: initial?.tags?.join(", ") ?? "",
    },
  });

  const watchType = form.watch("type");
  const activeAccounts = accounts.filter((item) => !item.archived);
  const currency = profile?.currency ?? "INR";

  async function onSubmit(values: TransactionValues) {
    await saveTransaction(
      {
        type: values.type,
        amount: values.amount,
        date: values.date,
        description: values.description,
        notes: values.notes,
        merchant: values.merchant,
        categoryId: values.categoryId || null,
        accountId: values.type === "transfer" ? null : values.accountId || null,
        fromAccountId: values.type === "transfer" ? values.fromAccountId || null : null,
        toAccountId: values.type === "transfer" ? values.toAccountId || null : null,
        paymentMethod: values.paymentMethod,
        tags: values.tags ? values.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
        attachments,
        isCreditCardPayment: false,
        status: "cleared",
      },
      initial?.id,
    );
    onDone?.();
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" error={form.formState.errors.type?.message}>
          <Select
            value={form.watch("type")}
            onValueChange={(value) => {
              const next = value as FormType;
              form.setValue("type", next);
              const current = categories.find((item) => item.id === form.getValues("categoryId"));
              if (current && current.kind !== next) form.setValue("categoryId", "");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Amount" error={form.formState.errors.amount?.message}>
          <MoneyInput
            currency={currency}
            value={form.watch("amount")}
            onChange={(value) => form.setValue("amount", value, { shouldValidate: true })}
          />
        </Field>
      </div>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Input {...form.register("description")} placeholder="What was this for?" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" error={form.formState.errors.date?.message}>
          <Input type="date" {...form.register("date")} />
        </Field>
        {watchType !== "transfer" ? (
          <Field label="Account" error={form.formState.errors.accountId?.message}>
            <Select
              value={form.watch("accountId") ?? ""}
              onValueChange={(value) => form.setValue("accountId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} textValue={accountLabel(account)} className="[&>span:last-child]:w-full">
                    <span className="min-w-0 truncate">{accountLabel(account)}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {formatMoney(accountBalance(account), currency)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field label="From" error={form.formState.errors.fromAccountId?.message}>
            <Select
              value={form.watch("fromAccountId") ?? ""}
              onValueChange={(value) => form.setValue("fromAccountId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      {watchType === "transfer" ? (
        <Field label="To" error={form.formState.errors.toAccountId?.message}>
          <Select
            value={form.watch("toAccountId") ?? ""}
            onValueChange={(value) => form.setValue("toAccountId", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <Field label="Category">
          <CategorySelect
            categories={categories.filter((item) => item.kind === watchType)}
            value={form.watch("categoryId") ?? ""}
            onChange={(value) => form.setValue("categoryId", value)}
            placeholder="Select category"
          />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Merchant">
          <Input {...form.register("merchant")} placeholder="Optional" />
        </Field>
        <Field label="Tags">
          <Input {...form.register("tags")} placeholder="food, work" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea {...form.register("notes")} placeholder="Optional notes" rows={3} />
      </Field>
      <Field label="Receipt">
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !user) return;
            const uploaded = await uploadReceipt(user.uid, file, initial?.id ?? "draft");
            setAttachments((current) => [...current, uploaded]);
          }}
        />
        {attachments.length ? (
          <ul className="space-y-1 text-xs">
            {attachments.map((item) => (
              <li key={item.id}>
                <a className="underline" href={item.url} target="_blank" rel="noreferrer">
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
