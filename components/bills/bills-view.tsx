"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Badge } from "@/components/ui/badge";
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
import { billStatus } from "@/lib/finance/calculations";
import { daysUntil, todayISO } from "@/lib/utils/dates";
import { billSchema, type BillValues } from "@/lib/validations";
import { getErrorMessage } from "@/lib/firebase/errors";
import { EntityNotes } from "@/components/notes/entity-notes";

export function BillsView() {
  const { profile } = useAuth();
  const { bills, accounts, saveBill, removeBill, markBillPaid } = useFinance();
  const [open, setOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const currency = profile?.currency ?? "INR";
  const form = useForm<BillValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      dueDate: todayISO(),
      frequency: "monthly",
      reminderDays: 3,
      autoRecurring: false,
    },
  });

  return (
    <div>
      <PageHeader title="Bills" description="Upcoming, due, and overdue payments">
        <Button onClick={() => setOpen(true)}>Add bill</Button>
      </PageHeader>
      {bills.length ? (
        <div className="space-y-3">
          {bills.map((bill) => {
            const status = billStatus(bill);
            const days = daysUntil(bill.dueDate);
            return (
              <Card key={bill.id} className="rounded-lg">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {days < 0 ? "Overdue" : days === 0 ? "Due today" : `Due in ${days} days`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CurrencyDisplay amount={bill.amount} currency={currency} className="font-medium" />
                    <Badge variant={status === "overdue" ? "destructive" : status === "paid" ? "secondary" : "outline"}>
                      {status.replace("_", " ")}
                    </Badge>
                    {status !== "paid" ? (
                      <Button size="sm" onClick={() => setPayId(bill.id)}>
                        Mark paid
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(bill.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
                <div className="px-5 pb-4">
                  <EntityNotes
                    type="bill"
                    entityId={bill.id}
                    entityName={bill.name}
                    inlineNote={bill.notes}
                    compact
                    onSaveInline={async (value) => {
                      await saveBill({ ...bill, notes: value }, bill.id);
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="Track rent, internet, subscriptions, and credit card dues."
          actionLabel="Add bill"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New bill</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await saveBill({ ...values, autoRecurring: Boolean(values.autoRecurring) });
                toast.success("Bill added");
                setOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            })}
          >
            <Field label="Name">
              <Input {...form.register("name")} placeholder="Internet" />
            </Field>
            <Field label="Amount">
              <MoneyInput currency={currency} value={form.watch("amount")} onChange={(value) => form.setValue("amount", value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" {...form.register("dueDate")} />
            </Field>
            <Field label="Frequency">
              <Select
                value={form.watch("frequency")}
                onValueChange={(value) => form.setValue("frequency", value as BillValues["frequency"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["once", "monthly", "quarterly", "yearly"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button className="w-full" type="submit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payId)} onOpenChange={(openState) => !openState && setPayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay from account</DialogTitle>
          </DialogHeader>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={async () => {
              if (payId && accountId) {
                await markBillPaid(payId, accountId);
                toast.success("Marked as paid");
              }
              setPayId(null);
            }}
          >
            Confirm
          </Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete bill?"
        description="Upcoming reminders for this bill will be removed."
        onConfirm={async () => {
          if (deleteId) await removeBill(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
