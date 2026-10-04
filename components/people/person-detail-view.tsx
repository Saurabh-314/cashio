"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/people/person-avatar";
import { PersonForm } from "@/components/people/person-form";
import { UdharForm } from "@/components/people/udhar-form";
import { RepaymentForm } from "@/components/people/repayment-form";
import { UdharStatusBadge } from "@/components/people/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { relationshipLabel } from "@/constants/people";
import { UDHAR_PAYMENT_METHODS } from "@/constants/people";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLabel } from "@/lib/finance/account-label";
import { formatMoney } from "@/lib/finance/money";
import {
  buildPersonLedger,
  dueLabel,
  isOpenUdhar,
  liveUdhars,
  notesFor,
  personBalance,
  planNetSettlement,
  positionAmount,
  positionCopy,
  udharPaid,
  udharProgress,
} from "@/lib/finance/udhar";
import { getErrorMessage } from "@/lib/firebase/errors";
import { formatDate, todayISO } from "@/lib/utils/dates";
import type { CurrencyCode, Udhar, UdharType } from "@/types";

export function PersonDetailView({ personId }: { personId: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    people,
    udhars,
    udharRepayments,
    peopleNotes,
    accounts,
    addPersonNote,
    removePersonNote,
    cancelUdhar,
    removeUdhar,
    removePerson,
    settleNet,
  } = useFinance();
  const currency = profile?.currency ?? "INR";
  const person = people.find((item) => item.id === personId);
  const live = useMemo(
    () => liveUdhars(udhars, udharRepayments).filter((item) => item.personId === personId),
    [personId, udharRepayments, udhars],
  );
  const balance = useMemo(
    () => personBalance(personId, udhars, udharRepayments),
    [personId, udharRepayments, udhars],
  );
  const ledger = useMemo(
    () => buildPersonLedger(personId, udhars, udharRepayments).slice().reverse(),
    [personId, udharRepayments, udhars],
  );
  const [udharType, setUdharType] = useState<UdharType>("lent");
  const [udharOpen, setUdharOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payType, setPayType] = useState<UdharType | null>(null);
  const [payUdhar, setPayUdhar] = useState<Udhar | null>(null);
  const [settleUdhar, setSettleUdhar] = useState<Udhar | null>(null);
  const [netOpen, setNetOpen] = useState(false);
  const [note, setNote] = useState("");
  const [deletePerson, setDeletePerson] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  if (!person) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/people">
            <ArrowLeft /> Back
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">This person was not found.</p>
      </div>
    );
  }

  const netPlan = planNetSettlement(live);
  const personNotes = notesFor(peopleNotes, person.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/people">
            <ArrowLeft /> People
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeletePerson(true)}>
            Remove
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-4">
        <PersonAvatar person={person} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-medium tracking-tight">{person.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {relationshipLabel(person.relationship)}
            {person.phone ? ` · ${person.phone}` : ""}
          </p>
          <p className="mt-3 text-sm">
            <span className="font-medium">{positionCopy(balance, person.name)}</span>
            {positionAmount(balance) > 0 ? (
              <>
                {" "}
                <CurrencyDisplay amount={positionAmount(balance)} currency={currency} className="text-lg font-semibold" />
              </>
            ) : null}
          </p>
          {balance.theyOwe > 0 && balance.youOwe > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              You owe {formatMoney(balance.youOwe, currency)} · {person.name} owes you{" "}
              {formatMoney(balance.theyOwe, currency)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total lent" amount={balance.totalLent} currency={currency} />
        <Stat label="Total borrowed" amount={balance.totalBorrowed} currency={currency} />
        <Stat label="They owe you" amount={balance.theyOwe} currency={currency} />
        <Stat label="You owe" amount={balance.youOwe} currency={currency} />
      </div>
      <p className="text-sm text-muted-foreground">
        Next due: {balance.nextDueDate ? dueLabel(balance.nextDueDate) : "No due date"}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setUdharType("lent");
            setUdharOpen(true);
          }}
        >
          I lent money
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUdharType("borrowed");
            setUdharOpen(true);
          }}
        >
          I borrowed money
        </Button>
        {balance.theyOwe > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setPayType("lent")}>
            Record payment received
          </Button>
        ) : null}
        {balance.youOwe > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setPayType("borrowed")}>
            Make payment
          </Button>
        ) : null}
        {balance.theyOwe > 0 && balance.youOwe > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setNetOpen(true)}>
            Settle net amount
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4 space-y-4">
          {ledger.length ? (
            ledger.map((row) => (
              <div key={row.id} className="border-b border-border pb-4 last:border-0">
                <p className="text-xs text-muted-foreground">{formatDate(row.date, profile?.dateFormat)}</p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{row.description}</p>
                  <CurrencyDisplay
                    amount={
                      row.kind === "lent" || row.kind === "repayment_made"
                        ? -row.amount
                        : row.kind === "borrowed" || row.kind === "repayment_received"
                          ? row.amount
                          : row.signedAmount
                    }
                    currency={currency}
                    signed
                    tone="auto"
                    className="text-sm font-medium"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.balance > 0
                    ? `${person.name} owes you ${formatMoney(row.balance, currency)}`
                    : row.balance < 0
                      ? `You owe ${formatMoney(Math.abs(row.balance), currency)}`
                      : "Settled"}
                </p>
                {row.notes ? <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No money has moved with {person.name} yet.</p>
          )}
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <Table>
            <TableCaption>
              Positive balance means they owe you. Negative means you owe them.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildPersonLedger(personId, udhars, udharRepayments).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.date, profile?.dateFormat)}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={row.signedAmount} currency={currency} signed className="text-sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={row.balance} currency={currency} signed className="text-sm" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="records" className="mt-4 space-y-3">
          {live.length ? (
            live.map((item) => {
              const progress = udharProgress(item);
              const paid = udharPaid(item);
              return (
                <Card key={item.id} className="rounded-lg">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {item.type === "lent" ? "You lent" : "You borrowed"} {formatMoney(item.principalAmount, currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.date, profile?.dateFormat)} · {dueLabel(item.dueDate)}
                        </p>
                      </div>
                      <UdharStatusBadge status={item.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Original</p>
                        <CurrencyDisplay amount={item.totalAmount} currency={currency} className="text-sm font-medium" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <CurrencyDisplay amount={paid} currency={currency} className="text-sm font-medium" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <CurrencyDisplay amount={item.outstandingAmount} currency={currency} className="text-sm font-medium" />
                      </div>
                    </div>
                    {item.interestAmount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Principal {formatMoney(item.principalAmount, currency)} · Interest{" "}
                        {formatMoney(item.interestAmount, currency)}
                      </p>
                    ) : null}
                    <Progress value={progress.percent} />
                    <p className="text-xs text-muted-foreground">{Math.round(progress.percent)}% paid</p>
                    {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}
                    {item.attachments?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {item.attachments.map((file) => (
                          <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="size-3" />
                            {file.name}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {isOpenUdhar(item) ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setPayUdhar(item);
                            setPayType(item.type);
                          }}
                        >
                          {item.type === "lent" ? "Record payment received" : "Make payment"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSettleUdhar(item)}>
                          Settle full amount
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setCancelId(item.id)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setRemoveId(item.id)}>
                        Delete record
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No lending or borrowing records yet.</p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          {person.notes ? <p className="text-sm text-muted-foreground">{person.notes}</p> : null}
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!note.trim()) return;
              try {
                await addPersonNote({ personId: person.id, body: note.trim() });
                setNote("");
                toast.success("Note saved");
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Usually pays on the 5th." />
            <Button type="submit" size="sm">
              Add note
            </Button>
          </form>
          <div className="space-y-3">
            {personNotes.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <p className="text-sm">{item.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{formatDate(item.createdAt.slice(0, 10), profile?.dateFormat)}</p>
                  <Button size="xs" variant="ghost" onClick={() => removePersonNote(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={udharOpen} onOpenChange={setUdharOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{udharType === "lent" ? "I lent money" : "I borrowed money"}</DialogTitle>
          </DialogHeader>
          <UdharForm type={udharType} personId={person.id} showTypePicker={false} onDone={() => setUdharOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit person</DialogTitle>
          </DialogHeader>
          <PersonForm person={person} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(payType)}
        onOpenChange={(open) => {
          if (!open) {
            setPayType(null);
            setPayUdhar(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{payType === "lent" ? "Record payment received" : "Make payment"}</DialogTitle>
          </DialogHeader>
          {payType ? (
            <RepaymentForm
              person={person}
              type={payType}
              udhar={payUdhar ?? undefined}
              onDone={() => {
                setPayType(null);
                setPayUdhar(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(settleUdhar)} onOpenChange={(open) => !open && setSettleUdhar(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settle full amount</DialogTitle>
          </DialogHeader>
          {settleUdhar ? (
            <RepaymentForm
              person={person}
              type={settleUdhar.type}
              udhar={settleUdhar}
              settleAmount={settleUdhar.outstandingAmount}
              onDone={() => setSettleUdhar(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={netOpen} onOpenChange={setNetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle net amount</DialogTitle>
          </DialogHeader>
          <NetSettleForm
            personName={person.name}
            net={netPlan.net}
            overlap={netPlan.overlap}
            currency={currency}
            defaultAccountId={profile?.defaultAccountId ?? accounts.find((item) => !item.archived)?.id ?? ""}
            accounts={accounts.filter((item) => !item.archived && item.kind !== "investment").map((item) => ({ id: item.id, name: accountLabel(item) }))}
            onConfirm={async (values) => {
              await settleNet({
                personId: person.id,
                accountId: values.accountId,
                paymentDate: values.date,
                paymentMethod: values.method,
              });
              toast.success("Net amount settled");
              setNetOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deletePerson}
        onOpenChange={setDeletePerson}
        title={`Remove ${person.name}?`}
        description="Open udhar must be settled or cancelled first. History stays unless you delete those records."
        onConfirm={async () => {
          try {
            await removePerson(person.id);
            router.push("/people");
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Stop tracking this udhar?"
        description="This does not move money in your accounts. Use it when you no longer want to follow this balance."
        confirmLabel="Cancel udhar"
        onConfirm={async () => {
          if (cancelId) await cancelUdhar(cancelId);
          setCancelId(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title="Delete this record?"
        description="This reverses the related account movement and removes the history for this udhar."
        onConfirm={async () => {
          if (removeId) await removeUdhar(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}

function Stat({ label, amount, currency }: { label: string; amount: number; currency: CurrencyCode }) {
  return (
    <Card className="rounded-lg">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <CurrencyDisplay amount={amount} currency={currency} className="mt-1 text-lg font-semibold" />
      </CardContent>
    </Card>
  );
}

function NetSettleForm({
  personName,
  net,
  overlap,
  currency,
  defaultAccountId,
  accounts,
  onConfirm,
}: {
  personName: string;
  net: number;
  overlap: number;
  currency: CurrencyCode;
  defaultAccountId: string;
  accounts: { id: string; name: string }[];
  onConfirm: (values: { accountId: string; date: string; method: "upi" | "cash" | "bank" | "card" | "other" }) => Promise<void>;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<"upi" | "cash" | "bank" | "card" | "other">("upi");
  const cash = Math.abs(net);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Overlapping amounts of {formatMoney(overlap, currency)} will be offset without moving cash. Original records stay in history.
      </p>
      {cash > 0 ? (
        <p className="text-sm">
          {net > 0 ? `${personName} still owes you ` : `You still owe ${personName} `}
          <span className="font-medium">{formatMoney(cash, currency)}</span>.
        </p>
      ) : (
        <p className="text-sm">You’re even after the offset.</p>
      )}
      {cash > 0 ? (
        <>
          <Field label="Amount">
            <MoneyInput currency={currency} value={cash} onChange={() => undefined} />
          </Field>
          <Field label={net > 0 ? "Received into" : "Paid from"}>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="How">
              <Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
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
        </>
      ) : null}
      <Button
        className="w-full"
        onClick={async () => {
          try {
            await onConfirm({ accountId, date, method });
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      >
        Confirm
      </Button>
    </div>
  );
}
