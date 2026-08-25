"use client";

import { useState } from "react";
import { Target } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { goalProgress } from "@/lib/finance/calculations";
import { ACCOUNT_COLORS } from "@/constants/categories";
import { goalSchema, type GoalValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";
import { EntityNotes } from "@/components/notes/entity-notes";

export function GoalsView() {
  const { profile } = useAuth();
  const { goals, saveGoal, removeGoal, contributeToGoal } = useFinance();
  const [open, setOpen] = useState(false);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const currency = profile?.currency ?? "INR";
  const form = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      targetAmount: 0,
      currentAmount: 0,
      targetDate: "",
      icon: "target",
      color: ACCOUNT_COLORS[0],
    },
  });

  return (
    <div>
      <PageHeader title="Goals" description="Save toward something that matters">
        <Button onClick={() => setOpen(true)}>New goal</Button>
      </PageHeader>
      {goals.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            return (
              <Card key={goal.id} className="rounded-lg">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoneySafe(progress.monthlyRequired, currency)} / month to finish on time
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(goal.id)}>
                      Delete
                    </Button>
                  </div>
                  <Progress value={progress.percent} />
                  <div className="flex justify-between text-sm">
                    <CurrencyDisplay amount={goal.currentAmount} currency={currency} />
                    <span className="text-muted-foreground">
                      of <CurrencyDisplay amount={goal.targetAmount} currency={currency} />
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setContributeId(goal.id)}>
                    Add money
                  </Button>
                  <EntityNotes
                    type="goal"
                    entityId={goal.id}
                    entityName={goal.name}
                    inlineNote={goal.description}
                    compact
                    onSaveInline={async (value) => {
                      await saveGoal({ ...goal, description: value }, goal.id);
                    }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Start your first savings goal"
          description="Emergency fund, vacation, or a new laptop — track the progress."
          actionLabel="Create goal"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New goal</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveGoal(values);
                toast.success("Goal created");
                setOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Name">
              <Input {...form.register("name")} placeholder="Emergency fund" />
            </Field>
            <Field label="Target">
              <MoneyInput
                currency={currency}
                value={form.watch("targetAmount")}
                onChange={(value) => form.setValue("targetAmount", value)}
              />
            </Field>
            <Field label="Currently saved">
              <MoneyInput
                currency={currency}
                value={form.watch("currentAmount")}
                onChange={(value) => form.setValue("currentAmount", value)}
              />
            </Field>
            <Field label="Target date">
              <Input type="date" {...form.register("targetDate")} />
            </Field>
            <Button className="w-full" type="submit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(contributeId)} onOpenChange={(openState) => !openState && setContributeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add money</DialogTitle>
          </DialogHeader>
          <MoneyInput currency={currency} value={amount} onChange={setAmount} />
          <Button
            onClick={async () => {
              if (contributeId) await contributeToGoal(contributeId, amount);
              setContributeId(null);
              setAmount(0);
              toast.success("Contribution added");
            }}
          >
            Save
          </Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete goal?"
        description="Saved progress will be removed from this tracker."
        onConfirm={async () => {
          if (deleteId) await removeGoal(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function formatMoneySafe(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
