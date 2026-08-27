"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CategorySelect } from "@/components/forms/category-select";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { nextOccurrence, todayISO } from "@/lib/utils/dates";
import { recurringSchema, type RecurringValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";

export function RecurringView() {
  const { profile } = useAuth();
  const { recurring, accounts, categories, saveRecurring, removeRecurring, saveTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const currency = profile?.currency ?? "INR";
  const form = useForm<RecurringValues>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: "expense",
      amount: 0,
      description: "",
      startDate: todayISO(),
      frequency: "monthly",
      autoCreate: false,
    },
  });

  return (
    <div>
      <PageHeader title="Recurring" description="Salary, rent, subscriptions, and EMIs">
        <Button onClick={() => setOpen(true)}>Add recurring</Button>
      </PageHeader>
      {recurring.length ? (
        <div className="space-y-3">
          {recurring.map((item) => (
            <Card key={item.id} className="rounded-lg">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.frequency} · next {item.nextRunDate}
                    {item.autoCreate ? " · auto" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CurrencyDisplay amount={item.amount} currency={currency} signed tone={item.type === "income" ? "income" : "expense"} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await saveTransaction({
                        type: item.type,
                        amount: item.amount,
                        date: todayISO(),
                        description: item.description,
                        categoryId: item.categoryId ?? null,
                        accountId: item.accountId ?? null,
                        fromAccountId: item.fromAccountId ?? null,
                        toAccountId: item.toAccountId ?? null,
                        tags: ["recurring"],
                        isCreditCardPayment: false,
                        status: "cleared",
                        recurringId: item.id,
                      });
                      await saveRecurring(
                        { ...item, lastRunDate: todayISO(), nextRunDate: nextOccurrence(item.nextRunDate, item.frequency) },
                        item.id,
                      );
                      toast.success("Transaction created");
                    }}
                  >
                    Run now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(item.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Repeat}
          title="No recurring items"
          description="Track salary, rent, Netflix, and other repeating cash flows."
          actionLabel="Add recurring"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recurring transaction</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveRecurring({
                  ...values,
                  autoCreate: Boolean(values.autoCreate),
                  nextRunDate: values.startDate,
                });
                toast.success("Saved");
                setOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Description">
              <Input {...form.register("description")} />
            </Field>
            <Field label="Amount">
              <MoneyInput currency={currency} value={form.watch("amount")} onChange={(value) => form.setValue("amount", value)} />
            </Field>
            <Field label="Type">
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value as RecurringValues["type"])}
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
            <Field label="Account">
              <Select value={form.watch("accountId") ?? ""} onValueChange={(value) => form.setValue("accountId", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <CategorySelect
                categories={categories}
                value={form.watch("categoryId") ?? ""}
                onChange={(value) => form.setValue("categoryId", value)}
                placeholder="Category"
              />
            </Field>
            <Field label="Start date">
              <Input type="date" {...form.register("startDate")} />
            </Field>
            <Field label="Frequency">
              <Select
                value={form.watch("frequency")}
                onValueChange={(value) => form.setValue("frequency", value as RecurringValues["frequency"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["daily", "weekly", "monthly", "quarterly", "yearly"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center justify-between text-sm">
              Create transaction automatically
              <Switch
                checked={Boolean(form.watch("autoCreate"))}
                onCheckedChange={(checked) => form.setValue("autoCreate", checked)}
              />
            </label>
            <Button className="w-full" type="submit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete recurring item?"
        description="Existing transactions will not be removed."
        onConfirm={async () => {
          if (deleteId) await removeRecurring(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
