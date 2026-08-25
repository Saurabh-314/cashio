"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { investmentReturn } from "@/lib/finance/calculations";
import { roundMoney } from "@/lib/finance/money";
import { todayISO } from "@/lib/utils/dates";
import { investmentSchema, type InvestmentValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";

export function InvestmentsView() {
  const { profile } = useAuth();
  const { investments, saveInvestment, removeInvestment } = useFinance();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const currency = profile?.currency ?? "INR";
  const form = useForm<InvestmentValues>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      name: "",
      type: "mutual_funds",
      investedAmount: 0,
      currentValue: 0,
      date: todayISO(),
    },
  });
  const invested = investments.reduce((sum, item) => sum + item.investedAmount, 0);
  const current = investments.reduce((sum, item) => sum + item.currentValue, 0);
  const pnl = roundMoney(current - invested);

  return (
    <div>
      <PageHeader title="Investments" description="Manually track funds, stocks, gold, and deposits">
        <Button onClick={() => setOpen(true)}>Add investment</Button>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="rounded-lg">
          <CardContent>
            <p className="text-sm text-muted-foreground">Invested</p>
            <CurrencyDisplay amount={invested} currency={currency} className="text-xl font-semibold" />
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent>
            <p className="text-sm text-muted-foreground">Current value</p>
            <CurrencyDisplay amount={current} currency={currency} className="text-xl font-semibold" />
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent>
            <p className="text-sm text-muted-foreground">Profit / loss</p>
            <CurrencyDisplay amount={pnl} currency={currency} signed tone="auto" className="text-xl font-semibold" />
          </CardContent>
        </Card>
      </div>
      {investments.length ? (
        <div className="space-y-3">
          {investments.map((item) => {
            const result = investmentReturn(item);
            return (
              <Card key={item.id} className="rounded-lg">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{item.type.replace("_", " ")}</p>
                  </div>
                  <div className="text-right">
                    <CurrencyDisplay amount={item.currentValue} currency={currency} className="font-medium" />
                    <p className={result.pnl >= 0 ? "text-xs text-income" : "text-xs text-expense"}>
                      {result.percent.toFixed(1)}%
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(item.id)}>
                    Delete
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="No investments yet"
          description="Add mutual funds, stocks, gold, or deposits to include them in net worth."
          actionLabel="Add investment"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Investment</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveInvestment(values);
                toast.success("Saved");
                setOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Name">
              <Input {...form.register("name")} />
            </Field>
            <Field label="Type">
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value as InvestmentValues["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["stocks", "mutual_funds", "crypto", "gold", "fd", "other"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Invested">
              <MoneyInput
                currency={currency}
                value={form.watch("investedAmount")}
                onChange={(value) => form.setValue("investedAmount", value)}
              />
            </Field>
            <Field label="Current value">
              <MoneyInput
                currency={currency}
                value={form.watch("currentValue")}
                onChange={(value) => form.setValue("currentValue", value)}
              />
            </Field>
            <Field label="Date">
              <Input type="date" {...form.register("date")} />
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
        title="Delete investment?"
        description="This only removes the tracker."
        onConfirm={async () => {
          if (deleteId) await removeInvestment(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
