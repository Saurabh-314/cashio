"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { PersonAvatar } from "@/components/people/person-avatar";
import { PersonForm } from "@/components/people/person-form";
import { UdharForm } from "@/components/people/udhar-form";
import { UdharStatusBadge } from "@/components/people/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  dueLabel,
  isOpenUdhar,
  liveUdhars,
  matchesPersonSearch,
  matchesUdharSearch,
  peopleBalances,
  positionAmount,
  positionCopy,
  udharTotals,
} from "@/lib/finance/udhar";
import { formatDate, monthRange, previousMonthRange } from "@/lib/utils/dates";
import { relationshipLabel } from "@/constants/people";
import type { CurrencyCode, UdharStatus, UdharType } from "@/types";

export function PeopleView() {
  const { profile } = useAuth();
  const { people, udhars, udharRepayments } = useFinance();
  const currency = profile?.currency ?? "INR";
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [direction, setDirection] = useState<UdharType | "all">("all");
  const [status, setStatus] = useState<UdharStatus | "all">("all");
  const [datePreset, setDatePreset] = useState("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const live = useMemo(() => liveUdhars(udhars, udharRepayments), [udharRepayments, udhars]);
  const totals = useMemo(() => udharTotals(udhars, udharRepayments), [udharRepayments, udhars]);
  const rows = useMemo(() => peopleBalances(people, udhars, udharRepayments), [people, udharRepayments, udhars]);
  const theyOwe = rows
    .filter((row) => row.balance.theyOwe > 0)
    .sort((a, b) => b.balance.theyOwe - a.balance.theyOwe);
  const youOwe = rows
    .filter((row) => row.balance.youOwe > 0)
    .sort((a, b) => b.balance.youOwe - a.balance.youOwe);
  const directory = rows.filter((row) => matchesPersonSearch(row.person, query));

  const filteredUdhar = useMemo(() => {
    const range =
      datePreset === "this" ? monthRange() : datePreset === "last" ? previousMonthRange() : null;
    return live.filter((item) => {
      const person = people.find((row) => row.id === item.personId);
      if (direction !== "all" && item.type !== direction) return false;
      if (status !== "all" && item.status !== status) return false;
      if (range && (item.date < range.start || item.date > range.end)) return false;
      const min = Number(minAmount);
      const max = Number(maxAmount);
      if (minAmount && item.principalAmount < min) return false;
      if (maxAmount && item.principalAmount > max) return false;
      return matchesUdharSearch(item, person, query);
    });
  }, [datePreset, direction, live, maxAmount, minAmount, people, query, status]);

  const dated = live.filter((item) => isOpenUdhar(item) && item.dueDate);
  const overdue = dated.filter((item) => item.status === "overdue");
  const dueSoon = dated.filter((item) => item.status !== "overdue");

  return (
    <div className="space-y-6">
      <PageHeader title="People & Udhar" description="Informal money between you and people you know">
        <Button variant="outline" onClick={() => setPersonOpen(true)}>
          Add person
        </Button>
        <Button onClick={() => setAddOpen(true)}>+ Add Udhar</Button>
      </PageHeader>

      {!people.length && !udhars.length ? (
        <EmptyState
          icon={Users}
          title="No people yet"
          description="Track money lent to friends or borrowed from family — without treating it as income or expense."
          actionLabel="Add Udhar"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="They owe you" amount={totals.theyOwe} currency={currency} />
            <SummaryCard label="You owe" amount={totals.youOwe} currency={currency} />
            <SummaryCard
              label="Net position"
              amount={Math.abs(totals.net)}
              currency={currency}
              hint={totals.net === 0 ? "You're even" : totals.net > 0 ? "They owe you more" : "You owe more"}
            />
          </div>

          {overdue.length || dueSoon.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {dueSoon.length ? (
                <Card className="rounded-lg">
                  <CardHeader>
                    <CardTitle>Upcoming</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dueSoon.slice(0, 4).map((item) => (
                      <DueRow
                        key={item.id}
                        personName={people.find((row) => row.id === item.personId)?.name ?? "Someone"}
                        personId={item.personId}
                        amount={item.outstandingAmount}
                        dueDate={item.dueDate}
                        currency={currency}
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : null}
              {overdue.length ? (
                <Card className="rounded-lg border-destructive/20">
                  <CardHeader>
                    <CardTitle>Overdue</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {overdue.slice(0, 4).map((item) => (
                      <DueRow
                        key={item.id}
                        personName={people.find((row) => row.id === item.personId)?.name ?? "Someone"}
                        personId={item.personId}
                        amount={item.outstandingAmount}
                        dueDate={item.dueDate}
                        currency={currency}
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          <Tabs defaultValue="people">
            <TabsList>
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="udhar">Udhar</TabsTrigger>
              <TabsTrigger value="directory">Directory</TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, phone, amount…"
              />
            </div>

            <TabsContent value="people" className="mt-4 grid gap-4 lg:grid-cols-2">
              <PeopleColumn
                title="People who owe you"
                empty="Nobody owes you right now."
                rows={theyOwe.filter((row) => matchesPersonSearch(row.person, query))}
                currency={currency}
                side="they"
              />
              <PeopleColumn
                title="People you owe"
                empty="You don't owe anyone right now."
                rows={youOwe.filter((row) => matchesPersonSearch(row.person, query))}
                currency={currency}
                side="you"
              />
            </TabsContent>

            <TabsContent value="udhar" className="mt-4 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Select value={direction} onValueChange={(value) => setDirection(value as typeof direction)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="lent">Lent</SelectItem>
                    <SelectItem value="borrowed">Borrowed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="partially_paid">Partially paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={datePreset} onValueChange={setDatePreset}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any date</SelectItem>
                    <SelectItem value="this">This month</SelectItem>
                    <SelectItem value="last">Last month</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  placeholder="Min amount"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                />
                <Input
                  inputMode="decimal"
                  placeholder="Max amount"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                />
              </div>
              <div className="divide-y rounded-lg border bg-card">
                {filteredUdhar.length ? (
                  filteredUdhar.map((item) => {
                    const person = people.find((row) => row.id === item.personId);
                    return (
                      <Link
                        key={item.id}
                        href={person ? `/people/${person.id}` : "/people"}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
                      >
                        {person ? <PersonAvatar person={person} /> : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{person?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.type === "lent" ? "You lent" : "You borrowed"} ·{" "}
                            {formatDate(item.date, profile?.dateFormat)}
                          </p>
                        </div>
                        <div className="text-right">
                          <CurrencyDisplay
                            amount={item.outstandingAmount}
                            currency={currency}
                            className="text-sm font-medium"
                          />
                          <div className="mt-1 flex justify-end">
                            <UdharStatusBadge status={item.status} />
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <p className="p-8 text-center text-sm text-muted-foreground">No matching udhar records.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="directory" className="mt-4">
              <div className="divide-y rounded-lg border bg-card">
                {directory.length ? (
                  directory.map(({ person, balance }) => (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
                    >
                      <PersonAvatar person={person} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{person.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {relationshipLabel(person.relationship)}
                          {person.phone ? ` · ${person.phone}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{positionCopy(balance, person.name)}</p>
                        <CurrencyDisplay
                          amount={positionAmount(balance)}
                          currency={currency}
                          className="text-sm font-medium"
                        />
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="p-8 text-center text-sm text-muted-foreground">No people match that search.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Udhar</DialogTitle>
          </DialogHeader>
          <UdharForm onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
      <Dialog open={personOpen} onOpenChange={setPersonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>
          <PersonForm onDone={() => setPersonOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  currency,
  hint,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  hint?: string;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <CurrencyDisplay amount={amount} currency={currency} className="mt-1 text-2xl font-semibold" />
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function PeopleColumn({
  title,
  empty,
  rows,
  currency,
  side,
}: {
  title: string;
  empty: string;
  rows: ReturnType<typeof peopleBalances>;
  currency: CurrencyCode;
  side: "they" | "you";
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length ? (
          rows.map(({ person, balance }) => (
            <Link
              key={person.id}
              href={`/people/${person.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-1 py-2 hover:bg-muted/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar person={person} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {side === "they" ? "Owes you" : "You owe"}
                    {balance.overdueCount ? " · overdue" : ""}
                  </p>
                </div>
              </div>
              <CurrencyDisplay
                amount={side === "they" ? balance.theyOwe : balance.youOwe}
                currency={currency}
                className="text-sm font-medium"
              />
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DueRow({
  personName,
  personId,
  amount,
  dueDate,
  currency,
}: {
  personName: string;
  personId: string;
  amount: number;
  dueDate?: string | null;
  currency: CurrencyCode;
}) {
  return (
    <Link href={`/people/${personId}`} className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{personName}</p>
        <p className="text-xs text-muted-foreground">{dueLabel(dueDate)}</p>
      </div>
      <CurrencyDisplay amount={amount} currency={currency} className="text-sm font-medium" />
    </Link>
  );
}
