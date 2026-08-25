"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionForm } from "@/components/forms/transaction-form";
import { UdharForm } from "@/components/people/udhar-form";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { useIsMobile } from "@/hooks/use-media-query";
import { todayISO } from "@/lib/utils/dates";
import { billSchema, goalSchema } from "@/lib/validations";
import type { QuickAddKind } from "@/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/firebase/errors";

function QuickAddBody() {
  const router = useRouter();
  const { profile } = useAuth();
  const { quickAddKind, openQuickAdd, closeQuickAdd, saveBill, contributeToGoal, goals, accounts, categories } =
    useFinance();
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState(0);
  const [billDue, setBillDue] = useState(todayISO());
  const [goalId, setGoalId] = useState("");
  const [goalAmount, setGoalAmount] = useState(0);

  async function createBill() {
    const parsed = billSchema.safeParse({
      name: billName,
      amount: billAmount,
      dueDate: billDue,
      frequency: "monthly",
      reminderDays: 3,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the bill details");
      return;
    }
    try {
      await saveBill({
        ...parsed.data,
        autoRecurring: false,
        categoryId: categories.find((item) => item.name === "Bills & Utilities")?.id,
      });
      toast.success("Bill added");
      closeQuickAdd();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function contribute() {
    if (!goalId || goalAmount <= 0) {
      toast.error("Choose a goal and amount");
      return;
    }
    const parsed = goalSchema.pick({ currentAmount: true }).safeParse({ currentAmount: goalAmount });
    if (!parsed.success) return;
    try {
      await contributeToGoal(goalId, goalAmount);
      toast.success("Contribution saved");
      closeQuickAdd();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Tabs value={quickAddKind} onValueChange={(value) => openQuickAdd(value as QuickAddKind)}>
      <TabsList className="mb-4 flex h-auto w-full flex-wrap">
        <TabsTrigger value="expense">Expense</TabsTrigger>
        <TabsTrigger value="income">Income</TabsTrigger>
        <TabsTrigger value="transfer">Transfer</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="bill">Bill</TabsTrigger>
        <TabsTrigger value="goal">Goal</TabsTrigger>
        <TabsTrigger value="udhar">Udhar</TabsTrigger>
      </TabsList>
      <TabsContent value="expense">
        <TransactionForm type="expense" onDone={closeQuickAdd} submitLabel="Add expense" />
      </TabsContent>
      <TabsContent value="income">
        <TransactionForm type="income" onDone={closeQuickAdd} submitLabel="Add income" />
      </TabsContent>
      <TabsContent value="transfer">
        <TransactionForm type="transfer" onDone={closeQuickAdd} submitLabel="Transfer" />
      </TabsContent>
      <TabsContent value="activity" className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Daily Check is for services like milk, maid, and newspaper — not fixed bills.
        </p>
        <Button
          className="w-full"
          onClick={() => {
            closeQuickAdd();
            router.push("/daily-check");
          }}
        >
          Open Daily Check
        </Button>
      </TabsContent>
      <TabsContent value="bill" className="space-y-3">
        <Field label="Bill name">
          <Input value={billName} onChange={(event) => setBillName(event.target.value)} />
        </Field>
        <Field label="Amount">
          <MoneyInput currency={profile?.currency ?? "INR"} value={billAmount} onChange={setBillAmount} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={billDue} onChange={(event) => setBillDue(event.target.value)} />
        </Field>
        <Button className="w-full" onClick={createBill}>
          Add bill
        </Button>
      </TabsContent>
      <TabsContent value="goal" className="space-y-3">
        <Field label="Goal">
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={goals.length ? "Select goal" : "Create a goal first"} />
            </SelectTrigger>
            <SelectContent>
              {goals.map((goal) => (
                <SelectItem key={goal.id} value={goal.id}>
                  {goal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Amount">
          <MoneyInput currency={profile?.currency ?? "INR"} value={goalAmount} onChange={setGoalAmount} />
        </Field>
        <Button className="w-full" onClick={contribute} disabled={!accounts.length}>
          Add contribution
        </Button>
      </TabsContent>
      <TabsContent value="udhar">
        <UdharForm onDone={closeQuickAdd} />
      </TabsContent>
    </Tabs>
  );
}

export function QuickAdd() {
  const { quickAddOpen, closeQuickAdd } = useFinance();
  const mobile = useIsMobile();
  const title = "Quick add";

  if (mobile) {
    return (
      <Sheet open={quickAddOpen} onOpenChange={(open) => !open && closeQuickAdd()}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-8">
            <QuickAddBody />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={quickAddOpen} onOpenChange={(open) => !open && closeQuickAdd()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <QuickAddBody />
      </DialogContent>
    </Dialog>
  );
}
