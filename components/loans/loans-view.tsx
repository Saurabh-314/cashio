"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
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
import { loanProgress } from "@/lib/finance/calculations";
import { todayISO } from "@/lib/utils/dates";
import { loanSchema, type LoanValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";

export function LoansView() {
  const { profile } = useAuth();
  const { loans, accounts, saveLoan, removeLoan, payLoan } = useFinance();
  const [open, setOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [principal, setPrincipal] = useState(0);
  const [interest, setInterest] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const currency = profile?.currency ?? "INR";
  const form = useForm<LoanValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      name: "",
      lender: "",
      loanType: "personal",
      principalAmount: 0,
      remainingAmount: 0,
      interestRate: 0,
      emi: 0,
      startDate: todayISO(),
      endDate: todayISO(),
      paymentDueDay: 5,
    },
  });
  const debt = loans.filter((item) => item.loanType !== "lent").reduce((sum, item) => sum + item.remainingAmount, 0);
  const emi = loans.reduce((sum, item) => sum + item.emi, 0);

  return (
    <div>
      <PageHeader title="Loans" description="Formal loans and EMIs. Informal money with people lives in People & Udhar.">
        <Button variant="outline" asChild>
          <a href="/people">People & Udhar</a>
        </Button>
        <Button onClick={() => setOpen(true)}>Add loan</Button>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="rounded-lg">
          <CardContent>
            <p className="text-sm text-muted-foreground">Remaining debt</p>
            <CurrencyDisplay amount={debt} currency={currency} className="text-2xl font-semibold" />
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent>
            <p className="text-sm text-muted-foreground">Monthly EMI</p>
            <CurrencyDisplay amount={emi} currency={currency} className="text-2xl font-semibold" />
          </CardContent>
        </Card>
      </div>
      {loans.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {loans.map((loan) => {
            const progress = loanProgress(loan);
            return (
              <Card key={loan.id} className="rounded-lg">
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{loan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {loan.lender} · {loan.loanType.replace("_", " ")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(loan.id)}>
                      Delete
                    </Button>
                  </div>
                  <Progress value={progress.percent} />
                  <div className="flex justify-between text-sm">
                    <span>Remaining</span>
                    <CurrencyDisplay amount={loan.remainingAmount} currency={currency} />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPayId(loan.id);
                      setPrincipal(Math.min(loan.emi, loan.remainingAmount));
                      setInterest(0);
                    }}
                  >
                    Record payment
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Add a personal loan, car loan, or home loan. For friends and family, use People & Udhar."
          actionLabel="Add loan"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveLoan(values);
                toast.success("Loan saved");
                setOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Name">
              <Input {...form.register("name")} />
            </Field>
            <Field label="Lender">
              <Input {...form.register("lender")} />
            </Field>
            <Field label="Type">
              <Select
                value={form.watch("loanType")}
                onValueChange={(value) => form.setValue("loanType", value as LoanValues["loanType"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["personal", "home", "car", "education", "credit_card", "other"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Principal">
              <MoneyInput
                currency={currency}
                value={form.watch("principalAmount")}
                onChange={(value) => form.setValue("principalAmount", value)}
              />
            </Field>
            <Field label="Remaining">
              <MoneyInput
                currency={currency}
                value={form.watch("remainingAmount")}
                onChange={(value) => form.setValue("remainingAmount", value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest %">
                <Input type="number" step="0.1" {...form.register("interestRate", { valueAsNumber: true })} />
              </Field>
              <Field label="EMI">
                <MoneyInput currency={currency} value={form.watch("emi")} onChange={(value) => form.setValue("emi", value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <Input type="date" {...form.register("startDate")} />
              </Field>
              <Field label="End">
                <Input type="date" {...form.register("endDate")} />
              </Field>
            </div>
            <Button className="w-full" type="submit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payId)} onOpenChange={(openState) => !openState && setPayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <Field label="Paid from">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((item) => item.kind !== "credit")
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Principal">
            <MoneyInput currency={currency} value={principal} onChange={setPrincipal} />
          </Field>
          <Field label="Interest (counts as expense)">
            <MoneyInput currency={currency} value={interest} onChange={setInterest} />
          </Field>
          <Button
            onClick={async () => {
              if (payId && accountId) {
                await payLoan(payId, principal, interest, accountId, todayISO());
                toast.success("Payment recorded");
              }
              setPayId(null);
            }}
          >
            Save payment
          </Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete loan?"
        description="This removes the loan tracker, not historical payments."
        onConfirm={async () => {
          if (deleteId) await removeLoan(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
