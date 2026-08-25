"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
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
import { UDHAR_PAYMENT_METHODS } from "@/constants/people";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { isOpenUdhar, liveUdhars } from "@/lib/finance/udhar";
import { formatMoney } from "@/lib/finance/money";
import { getErrorMessage } from "@/lib/firebase/errors";
import { todayISO } from "@/lib/utils/dates";
import { repaymentSchema, type RepaymentValues } from "@/lib/validations";
import { uploadUserFile } from "@/services/storage";
import type { Attachment, Person, Udhar, UdharType } from "@/types";

export function RepaymentForm({
  person,
  type,
  udhar,
  settleAmount,
  onDone,
}: {
  person: Person;
  type: UdharType;
  udhar?: Udhar;
  settleAmount?: number;
  onDone?: () => void;
}) {
  const { user, profile } = useAuth();
  const { accounts, udhars, udharRepayments, repayUdhar, settleUdharFull } = useFinance();
  const currency = profile?.currency ?? "INR";
  const received = type === "lent";
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const open = useMemo(() => {
    const live = liveUdhars(udhars, udharRepayments).filter(
      (item) => item.personId === person.id && item.type === type && isOpenUdhar(item),
    );
    return udhar ? live.filter((item) => item.id === udhar.id) : live;
  }, [person.id, type, udhar, udharRepayments, udhars]);
  const outstanding = open.reduce((sum, item) => sum + item.outstandingAmount, 0);
  const form = useForm<RepaymentValues>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: {
      amount: settleAmount ?? outstanding,
      accountId: profile?.defaultAccountId ?? accounts.find((item) => !item.archived && item.kind !== "credit")?.id ?? "",
      paymentDate: todayISO(),
      paymentMethod: "upi",
      notes: settleAmount ? "Settled in full" : "",
      udharId: udhar?.id ?? "",
    },
  });

  const moneyAccounts = accounts.filter((item) => !item.archived && item.kind !== "investment");

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          if (udhar && settleAmount) {
            await settleUdharFull({
              udharId: udhar.id,
              accountId: values.accountId,
              paymentDate: values.paymentDate,
              paymentMethod: values.paymentMethod,
              notes: values.notes,
            });
          } else {
            await repayUdhar({
              udharId: values.udharId || udhar?.id,
              personId: person.id,
              type,
              amount: values.amount,
              accountId: values.accountId,
              paymentDate: values.paymentDate,
              paymentMethod: values.paymentMethod,
              notes: values.notes,
              attachments,
            });
          }
          toast.success(received ? "Payment received" : "Payment recorded");
          onDone?.();
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      })}
    >
      <p className="text-sm text-muted-foreground">
        {received ? `${person.name} still owes ` : `You still owe ${person.name} `}
        {formatMoney(outstanding, currency)}.
      </p>
      <Field label="Amount" error={form.formState.errors.amount?.message}>
        <MoneyInput
          currency={currency}
          value={form.watch("amount")}
          onChange={(value) => form.setValue("amount", value)}
        />
      </Field>
      {!udhar && open.length > 1 ? (
        <Field label="Apply to">
          <Select
            value={form.watch("udharId") || "fifo"}
            onValueChange={(value) => form.setValue("udharId", value === "fifo" ? "" : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fifo">Oldest first</SelectItem>
              {open.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.date} · {formatMoney(item.outstandingAmount, currency)} left
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field label={received ? "Received into" : "Paid from"} error={form.formState.errors.accountId?.message}>
        <Select value={form.watch("accountId")} onValueChange={(value) => form.setValue("accountId", value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            {moneyAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" {...form.register("paymentDate")} />
        </Field>
        <Field label="How">
          <Select
            value={form.watch("paymentMethod")}
            onValueChange={(value) => form.setValue("paymentMethod", value as RepaymentValues["paymentMethod"])}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UDHAR_PAYMENT_METHODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea rows={2} {...form.register("notes")} placeholder="Partial repayment." />
      </Field>
      <Field label="Receipt">
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !user) return;
            try {
              const uploaded = await uploadUserFile(user.uid, file, "udhar");
              setAttachments((current) => [...current, uploaded]);
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        />
      </Field>
      <Button className="w-full" type="submit" disabled={!moneyAccounts.length || outstanding <= 0}>
        {received ? "Record payment received" : "Make payment"}
      </Button>
    </form>
  );
}
