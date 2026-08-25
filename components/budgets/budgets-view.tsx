"use client";

import { useState } from "react";
import { PiggyBank } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { budgetSpent, budgetStatus } from "@/lib/finance/calculations";
import { monthKey } from "@/lib/utils/dates";
import { budgetSchema, type BudgetValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";
import { cn } from "@/lib/utils";

export function BudgetsView() {
  const { profile } = useAuth();
  const { budgets, categories, accounts, transactions, saveBudget, removeBudget } = useFinance();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const form = useForm<BudgetValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { name: "", scope: "category", amount: 0, month: monthKey(), rollover: false },
  });
  const month = monthKey();
  const currency = profile?.currency ?? "INR";

  return (
    <div>
      <PageHeader title="Budgets" description="Keep monthly spending on track">
        <Button onClick={() => setOpen(true)}>Create budget</Button>
      </PageHeader>
      {budgets.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((budget) => {
            const spent = budgetSpent(budget, transactions, month);
            const remaining = budget.amount - spent;
            const pct = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
            const status = budgetStatus(spent, budget.amount);
            return (
              <Card key={budget.id} className="rounded-lg">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{budget.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{status.replace("near", "near limit")}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(budget.id)}>
                      Delete
                    </Button>
                  </div>
                  <Progress value={pct} />
                  <div className="flex justify-between text-sm">
                    <span>
                      Spent <CurrencyDisplay amount={spent} currency={currency} />
                    </span>
                    <span className={cn(remaining < 0 && "text-expense")}>
                      {remaining < 0 ? "Over" : "Left"}{" "}
                      <CurrencyDisplay amount={Math.abs(remaining)} currency={currency} />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={PiggyBank}
          title="Create your first budget"
          description="Set a monthly limit for food, rent, or overall spending."
          actionLabel="Create budget"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New budget</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveBudget({
                  name: values.name,
                  scope: values.scope,
                  amount: values.amount,
                  month: values.month,
                  categoryId: values.categoryId,
                  accountId: values.accountId,
                  rollover: Boolean(values.rollover),
                });
                toast.success("Budget created");
                setOpen(false);
                form.reset();
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Scope">
              <Select
                value={form.watch("scope")}
                onValueChange={(value) => form.setValue("scope", value as BudgetValues["scope"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.watch("scope") === "category" ? (
              <Field label="Category">
                <Select value={form.watch("categoryId") ?? ""} onValueChange={(value) => form.setValue("categoryId", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((item) => item.kind === "expense")
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {form.watch("scope") === "account" ? (
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
            ) : null}
            <Field label="Amount">
              <MoneyInput currency={currency} value={form.watch("amount")} onChange={(value) => form.setValue("amount", value)} />
            </Field>
            <Button className="w-full" type="submit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete budget?"
        description="This will not delete related transactions."
        onConfirm={async () => {
          if (deleteId) await removeBudget(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
