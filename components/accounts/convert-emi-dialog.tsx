"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLabel } from "@/lib/finance/account-label";
import {
  absorbEmiPrincipal,
  convertibleCharges,
  emiInstallmentCount,
  nextDueDate,
  openingAvailable,
} from "@/lib/finance/credit-emi";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/firebase/errors";
import type { Account } from "@/types";

export function ConvertEmiDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useAuth();
  const { accounts, transactions, creditEmis, createCreditEmi } = useFinance();
  const currency = profile?.currency ?? "INR";
  const dateFormat = profile?.dateFormat ?? "dd MMM yyyy";
  const charges = useMemo(
    () => convertibleCharges(account, transactions, accounts, creditEmis),
    [account, transactions, accounts, creditEmis],
  );
  const [amount, setAmount] = useState(account.outstanding);
  const [monthly, setMonthly] = useState(0);
  const [interest, setInterest] = useState(0);
  const [startDate, setStartDate] = useState(nextDueDate(account.paymentDueDay ?? 10, new Date().toISOString().slice(0, 10)));
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState(`${account.name} EMI`);

  const preview = useMemo(() => {
    try {
      const plan = absorbEmiPrincipal(
        amount,
        charges,
        selected.length ? selected : null,
        openingAvailable(account, creditEmis),
      );
      const count = emiInstallmentCount(amount, monthly, interest);
      return { plan, count, error: null as string | null };
    } catch (error) {
      return { plan: null, count: 0, error: error instanceof Error ? error.message : "Check the amount" };
    }
  }, [account, amount, charges, creditEmis, interest, monthly, selected]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert {accountLabel(account)} to EMI</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Outstanding stays on the card, so the limit stays blocked. Bills will ask only for the monthly EMI, not the
          full amount.
        </p>
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Amount to convert">
          <MoneyInput currency={currency} value={amount} onChange={setAmount} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly EMI">
            <MoneyInput currency={currency} value={monthly} onChange={setMonthly} />
          </Field>
          <Field label="Interest in that EMI">
            <MoneyInput currency={currency} value={interest} onChange={setInterest} />
          </Field>
        </div>
        <Field label="First due date">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        {charges.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Spends to convert</p>
            <p className="text-xs text-muted-foreground">
              Leave these unchecked to use the oldest spends automatically.
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {charges.map((charge) => (
                <label key={charge.id} className="flex items-center gap-3 text-sm">
                  <Checkbox checked={selected.includes(charge.id)} onCheckedChange={() => toggle(charge.id)} />
                  <span className="min-w-0 flex-1 truncate">
                    {charge.description}
                    <span className="text-muted-foreground"> · {formatDate(charge.date, dateFormat)}</span>
                  </span>
                  <span>{formatMoney(charge.amount, currency)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {preview.error ? <p className="text-sm text-destructive">{preview.error}</p> : null}
        {preview.plan && preview.count > 0 ? (
          <p className="text-sm text-muted-foreground">
            {preview.count} payment{preview.count === 1 ? "" : "s"} of {formatMoney(monthly, currency)}. The card
            outstanding stays {formatMoney(account.outstanding, currency)} until you pay an installment.
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={!preview.plan || preview.count <= 0 || !startDate}
          onClick={async () => {
            try {
              await createCreditEmi({
                accountId: account.id,
                name,
                principalAmount: amount,
                monthlyAmount: monthly,
                monthlyInterest: interest,
                startDate,
                transactionIds: selected.length ? selected : null,
              });
              toast.success("Converted to EMI");
              onOpenChange(false);
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        >
          Convert
        </Button>
      </DialogContent>
    </Dialog>
  );
}
