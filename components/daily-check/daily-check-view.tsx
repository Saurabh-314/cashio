"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ClipboardCheck, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { ActivityForm } from "@/components/daily-check/activity-form";
import { CheckStatusBadge, SettlementStatusBadge } from "@/components/daily-check/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_GROUPS, SKIP_REASONS } from "@/constants/activities";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import {
  formatSchedule,
  monthStats,
  monthSummary,
  pricingLabel,
  previewSettlement,
  todayRows,
  todayStats,
} from "@/lib/finance/activity-calculations";
import { getErrorMessage } from "@/lib/firebase/errors";
import { monthKey, todayISO } from "@/lib/utils/dates";
import { dailyCheckFollowUps, dueLabel } from "@/lib/finance/udhar";
import { providerSchema, type ActivityValues, type ProviderValues } from "@/lib/validations";
import type { Activity, CurrencyCode, SkipReason } from "@/types";

export function DailyCheckView() {
  const { profile } = useAuth();
  const {
    activities,
    activityRecords,
    providers,
    settlements,
    accounts,
    categories,
    people,
    udhars,
    udharRepayments,
    saveActivity,
    saveProvider,
    checkIn,
    bulkCheckIn,
    paySettlement,
    removeProvider,
    dismissUdharFollowUp,
  } = useFinance();
  const currency = profile?.currency ?? "INR";
  const today = todayISO();
  const month = monthKey();
  const [tab, setTab] = useState("today");
  const [formOpen, setFormOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [skipTarget, setSkipTarget] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<{ activityId: string; month: string } | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payAccount, setPayAccount] = useState("");
  const [payDate, setPayDate] = useState(today);

  const active = activities.filter((item) => item.status !== "archived");
  const rows = useMemo(() => todayRows(active, activityRecords, today), [active, activityRecords, today]);
  const stats = todayStats(rows);
  const monthly = monthStats(active, activityRecords, month, today);
  const pendingRows = rows.filter((row) => row.status === "pending");

  const paymentRows = active
    .map((activity) => {
      const existing = settlements.find((item) => item.activityId === activity.id && item.month === month);
      const snap = previewSettlement(activity, activityRecords, month, existing, today);
      const status = existing?.status ?? snap.status;
      const provider = providers.find((item) => item.id === activity.providerId);
      return {
        activity,
        providerName: provider?.name ?? activity.providerName ?? "—",
        amount: snap.amount,
        paid: snap.paidAmount,
        due: snap.due,
        status,
        completedDays: monthSummary(activity, activityRecords, month).completedDays,
      };
    })
    .filter((row) => row.amount > 0 || row.paid > 0);

  const outstanding = paymentRows.filter((row) => row.status !== "paid");
  const outstandingTotal = outstanding.reduce((sum, row) => sum + row.due, 0);
  const udharFollowUps = dailyCheckFollowUps(
    udhars,
    udharRepayments,
    today,
    profile?.udharReminderDays ?? 1,
  );

  async function complete(activityId: string) {
    try {
      await checkIn({ activityId, status: "completed" });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function skip(activityId: string, reason?: SkipReason) {
    try {
      await checkIn({ activityId, status: "skipped", skipReason: reason });
      setSkipTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleSaveActivity(values: ActivityValues) {
    await saveActivity({
      name: values.name,
      group: values.group,
      categoryId: values.expenseCategoryId,
      expenseCategoryId: values.expenseCategoryId,
      providerId: values.providerId,
      icon: values.icon,
      color: values.color,
      description: values.description,
      providerName: values.providerName,
      providerPhone: values.providerPhone,
      providerNotes: values.providerNotes,
      pricingType: values.pricingType,
      amount: values.amount,
      unit: values.unit,
      defaultQuantity: values.defaultQuantity,
      frequency: values.frequency,
      activeDays: values.activeDays ?? [],
      startDate: values.startDate,
      endDate: values.endDate,
      status: "active",
      pauses: [],
      autoCreateExpense: values.autoCreateExpense ?? false,
      autoSettle: values.autoSettle ?? false,
      defaultAccountId: values.defaultAccountId,
      notes: values.notes,
    });
    setFormOpen(false);
    toast.success("Activity saved");
  }

  const providerForm = useForm<ProviderValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: { name: "", phone: "", address: "", notes: "", paymentPreference: "upi" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Check" description={format(new Date(), "EEEE, MMMM d")}>
        <Button variant="outline" onClick={() => setProviderOpen(true)}>
          Add provider
        </Button>
        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Add activity
        </Button>
      </PageHeader>

      {!active.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No recurring activities yet"
          description="Add milk, maid, newspaper, or any service you track day to day. Fixed bills like Netflix stay in Bills."
          actionLabel="Add activity"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>Today</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="Activities" value={stats.total} />
                  <Stat label="Done" value={stats.completed} />
                  <Stat label="Skipped" value={stats.skipped} />
                  <Stat label="Pending" value={stats.pending} />
                </CardContent>
              </Card>
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>This month</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="Expected" value={monthly.total} />
                  <Stat label="Done" value={monthly.completed} />
                  <Stat label="Missed" value={monthly.missed} />
                  <Stat label="Rate" value={`${monthly.rate.toFixed(0)}%`} />
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {stats.total} activities today · {stats.completed} completed
              </p>
              {pendingRows.length ? (
                <Button size="sm" onClick={() => setBulkOpen(true)}>
                  Mark all completed
                </Button>
              ) : null}
            </div>

            <div className="divide-y rounded-lg border bg-card">
              {rows.length ? (
                rows.map((row) => (
                  <div key={row.activity.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => (row.status === "pending" ? complete(row.activity.id) : undefined)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-sm"
                      aria-label={row.status === "completed" ? "Completed" : "Mark complete"}
                    >
                      {row.status === "completed" ? <Check className="size-4 text-success" /> : row.status === "skipped" ? "–" : ""}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{row.activity.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.activity.providerName || formatSchedule(row.activity)} ·{" "}
                        <CurrencyDisplay amount={row.activity.amount} currency={currency} className="text-xs" /> /{" "}
                        {pricingLabel(row.activity)}
                      </p>
                    </div>
                    <CheckStatusBadge status={row.status} />
                    {row.status === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => setSkipTarget(row.activity.id)}>
                        Skip
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/daily-check/${row.activity.id}`}>History</Link>
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Nothing expected today.
                </p>
              )}
            </div>

            {udharFollowUps.length ? (
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle>People follow-ups</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {udharFollowUps.map((item) => {
                    const person = people.find((row) => row.id === item.personId);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {person?.name ?? "Someone"} repayment follow-up
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dueLabel(item.dueDate)} ·{" "}
                            <CurrencyDisplay amount={item.outstandingAmount} currency={currency} className="text-xs" />
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/people/${item.personId}`}>Open</Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => dismissUdharFollowUp(item.id)}>
                            Done
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="activities" className="grid gap-3 md:grid-cols-2">
            {active.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} currency={currency} today={today} />
            ))}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card className="rounded-lg">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{format(new Date(), "MMMM")} settlement</CardTitle>
                <CurrencyDisplay amount={outstandingTotal} currency={currency} className="text-lg font-semibold" />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {outstanding.length} unpaid service{outstanding.length === 1 ? "" : "s"}
                </p>
                {paymentRows.length ? (
                  paymentRows.map((row) => (
                    <div
                      key={row.activity.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{row.activity.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.providerName} · {row.completedDays} completed
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <CurrencyDisplay amount={row.amount} currency={currency} className="text-sm font-medium" />
                          <p className="text-[11px] text-muted-foreground">
                            paid <CurrencyDisplay amount={row.paid} currency={currency} className="text-[11px]" /> · due{" "}
                            <CurrencyDisplay amount={row.due} currency={currency} className="text-[11px]" />
                          </p>
                        </div>
                        <SettlementStatusBadge status={row.status} />
                        {row.status !== "paid" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPayTarget({ activityId: row.activity.id, month });
                              setPayAmount(row.due);
                              setPayAccount(row.activity.defaultAccountId ?? accounts[0]?.id ?? "");
                            }}
                          >
                            Pay
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No amounts to settle this month yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers" className="space-y-3">
            {providers.length ? (
              providers.map((provider) => {
                const linked = active.filter((item) => item.providerId === provider.id);
                const due = paymentRows
                  .filter((row) => linked.some((item) => item.id === row.activity.id))
                  .reduce((sum, row) => sum + row.due, 0);
                return (
                  <Card key={provider.id} className="rounded-lg">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {linked.map((item) => item.name).join(", ") || "No activities yet"}
                          {provider.phone ? ` · ${provider.phone}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                          <CurrencyDisplay amount={due} currency={currency} className="font-medium" />
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeProvider(provider.id)}>
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="No providers yet"
                description="Save milkmen, maids, and other people you pay regularly."
                actionLabel="Add provider"
                onAction={() => setProviderOpen(true)}
                className="py-10"
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            categories={categories}
            providers={providers}
            onCancel={() => setFormOpen(false)}
            onSubmit={handleSaveActivity}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add provider</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={providerForm.handleSubmit(async (values) => {
              await saveProvider(values);
              setProviderOpen(false);
              providerForm.reset();
              toast.success("Provider saved");
            })}
          >
            <Field label="Name" error={providerForm.formState.errors.name?.message}>
              <Input {...providerForm.register("name")} />
            </Field>
            <Field label="Phone">
              <Input {...providerForm.register("phone")} />
            </Field>
            <Field label="Address">
              <Input {...providerForm.register("address")} />
            </Field>
            <Field label="Payment preference">
              <Select
                value={providerForm.watch("paymentPreference")}
                onValueChange={(value) =>
                  providerForm.setValue("paymentPreference", value as ProviderValues["paymentPreference"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea {...providerForm.register("notes")} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setProviderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(skipTarget)} onOpenChange={(open) => !open && setSkipTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip today</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Reason is optional.</p>
          <div className="flex flex-wrap gap-2">
            {SKIP_REASONS.map((reason) => (
              <Button key={reason.id} variant="outline" size="sm" onClick={() => skipTarget && skip(skipTarget, reason.id)}>
                {reason.label}
              </Button>
            ))}
          </div>
          <Button onClick={() => skipTarget && skip(skipTarget)}>Skip without reason</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payTarget)} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay service</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Amount">
              <MoneyInput value={payAmount} onChange={setPayAmount} />
            </Field>
            <Field label="Account">
              <Select value={payAccount} onValueChange={setPayAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((item) => !item.archived)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment date">
              <Input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
            </Field>
            <Button
              className="w-full"
              onClick={async () => {
                if (!payTarget || !payAccount) return;
                try {
                  await paySettlement({
                    activityId: payTarget.activityId,
                    month: payTarget.month,
                    amount: payAmount,
                    accountId: payAccount,
                    date: payDate,
                    createExpense: true,
                  });
                  toast.success("Payment recorded");
                  setPayTarget(null);
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }}
            >
              Pay and create expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Mark all completed?"
        description={`This will mark ${pendingRows.length} pending ${pendingRows.length === 1 ? "activity" : "activities"} as completed for today.`}
        confirmLabel="Mark all completed"
        destructive={false}
        onConfirm={async () => {
          await bulkCheckIn(
            pendingRows.map((row) => row.activity.id),
            "completed",
          );
          setBulkOpen(false);
          toast.success("All marked completed");
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ActivityCard({
  activity,
  currency,
  today,
}: {
  activity: Activity;
  currency: CurrencyCode;
  today: string;
}) {
  const { activityRecords, checkIn } = useFinance();
  const status = todayRows([activity], activityRecords, today)[0]?.status ?? "not_applicable";
  const summary = monthSummary(activity, activityRecords, today.slice(0, 7), today);

  return (
    <Card className="rounded-lg">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-3">
          <DynamicIcon name={activity.icon} className="mt-0.5 size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{activity.name}</p>
            <p className="text-xs text-muted-foreground">
              {ACTIVITY_GROUPS.find((item) => item.id === activity.group)?.label} · {formatSchedule(activity)}
            </p>
          </div>
          <CheckStatusBadge status={status} />
        </div>
        <p className="text-sm">
          <CurrencyDisplay amount={activity.amount} currency={currency} className="font-medium" />
          <span className="text-muted-foreground"> / {pricingLabel(activity)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          This month {summary.completedDays}/{summary.expectedDays} ·{" "}
          <CurrencyDisplay amount={summary.amount} currency={currency} className="text-xs" />
        </p>
        <div className="flex flex-wrap gap-1.5">
          {status === "pending" ? (
            <>
              <Button size="sm" onClick={() => checkIn({ activityId: activity.id, status: "completed" })}>
                Complete
              </Button>
              <Button size="sm" variant="outline" onClick={() => checkIn({ activityId: activity.id, status: "skipped" })}>
                Skip
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/daily-check/${activity.id}`}>View history</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
