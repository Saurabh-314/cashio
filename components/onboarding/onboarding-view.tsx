"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { AccountForm } from "@/components/forms/account-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/constants/currencies";
import { useFinance } from "@/hooks/use-finance";
import type { CurrencyCode } from "@/types";
import { monthKey } from "@/lib/utils/dates";

export function OnboardingView() {
  const router = useRouter();
  const { updateProfile, saveBudget, saveGoal, accounts } = useFinance();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [budget, setBudget] = useState(0);
  const [goalName, setGoalName] = useState("Emergency fund");
  const [goalAmount, setGoalAmount] = useState(0);

  async function finish(completed = true) {
    await updateProfile({
      currency,
      onboardingCompleted: true,
      defaultAccountId: accounts[0]?.id ?? null,
    });
    if (completed && budget > 0) {
      await saveBudget({
        name: "Monthly budget",
        scope: "overall",
        amount: budget,
        month: monthKey(),
        rollover: false,
      });
    }
    if (completed && goalAmount > 0) {
      await saveGoal({
        name: goalName || "Emergency fund",
        targetAmount: goalAmount,
        currentAmount: 0,
        targetDate: `${new Date().getFullYear()}-12-31`,
        icon: "shield",
        color: "#2F6B4F",
      });
    }
    router.replace("/dashboard");
  }

  const steps = [
    {
      title: "Welcome to Cashio",
      body: "Your personal finance dashboard for accounts, spending, goals, and debt — all in one calm, clear place.",
    },
    { title: "Choose your currency", body: "You can change this later in Settings." },
    { title: "Add your first account", body: "Bank, cash, or a credit card. Opening balance is enough to start." },
    { title: "Optional budget", body: "Set an overall monthly spending limit." },
    { title: "Optional goal", body: "Give your savings a destination." },
  ];

  return (
    <div className="mx-auto max-w-xl py-6">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Step {step + 1} of {steps.length}
      </p>
      <h1 className="font-display mt-2 text-[1.75rem] font-medium tracking-tight">{steps[step].title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{steps[step].body}</p>
      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        {step === 1 ? (
          <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CURRENCIES).map((item) => (
                <SelectItem key={item.code} value={item.code}>
                  {item.symbol} {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {step === 2 ? <AccountForm onDone={() => setStep(3)} /> : null}
        {step === 3 ? (
          <Field label="Monthly budget">
            <MoneyInput currency={currency} value={budget} onChange={setBudget} />
          </Field>
        ) : null}
        {step === 4 ? (
          <div className="space-y-3">
            <Field label="Goal name">
              <Input value={goalName} onChange={(event) => setGoalName(event.target.value)} />
            </Field>
            <Field label="Target amount">
              <MoneyInput currency={currency} value={goalAmount} onChange={setGoalAmount} />
            </Field>
          </div>
        ) : null}
        {step === 0 ? <p className="text-sm">We’ll help you set up currency, an account, and optional targets.</p> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep((value) => value - 1)}>
            Back
          </Button>
        ) : null}
        {step < 4 ? (
          <Button onClick={() => setStep((value) => value + 1)} disabled={step === 2 && !accounts.length}>
            Continue
          </Button>
        ) : (
          <Button onClick={() => finish(true)}>Go to dashboard</Button>
        )}
        <Button variant="ghost" onClick={() => finish(false)}>
          Skip
        </Button>
      </div>
    </div>
  );
}
