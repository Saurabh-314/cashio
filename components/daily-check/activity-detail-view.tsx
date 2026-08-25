"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field } from "@/components/forms/field";
import { ActivityForm } from "@/components/daily-check/activity-form";
import { CheckStatusBadge, SettlementStatusBadge } from "@/components/daily-check/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAUSE_REASONS } from "@/constants/activities";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import {
  activityQuantity,
  activityStreaks,
  dayStatus,
  formatQuantityWithUnit,
  formatSchedule,
  monthSummary,
  occurrenceAmount,
  previewSettlement,
  pricingLabel,
  usesQuantity,
} from "@/lib/finance/activity-calculations";
import { getErrorMessage } from "@/lib/firebase/errors";
import { monthKey, todayISO } from "@/lib/utils/dates";
import { pauseSchema, type ActivityValues, type PauseValues } from "@/lib/validations";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import type { ActivityCheckStatus } from "@/types";
import { EntityNotes } from "@/components/notes/entity-notes";
import { ActivityUnitPriceText } from "@/components/daily-check/activity-pricing";

const SYMBOL: Record<ActivityCheckStatus, string> = {
  completed: "✓",
  skipped: "–",
  cancelled: "×",
  pending: "○",
  missed: "•",
  not_applicable: "",
};

export function ActivityDetailView({ activityId }: { activityId: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    activities,
    activityRecords,
    providers,
    settlements,
    categories,
    accounts,
    saveActivity,
    removeActivity,
    checkIn,
    pauseActivity,
    resumeActivity,
    paySettlement,
  } = useFinance();
  const activity = activities.find((item) => item.id === activityId);
  const currency = profile?.currency ?? "INR";
  const today = todayISO();
  const [cursor, setCursor] = useState(new Date());
  const [editOpen, setEditOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dayTarget, setDayTarget] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payAccount, setPayAccount] = useState("");

  const month = format(cursor, "yyyy-MM");
  const summary = activity ? monthSummary(activity, activityRecords, month, today) : null;
  const streaks = activity ? activityStreaks(activity, activityRecords, today) : { current: 0, best: 0 };
  const provider = providers.find((item) => item.id === activity?.providerId);
  const existing = settlements.find((item) => item.activityId === activityId && item.month === month);
  const settlement = activity ? previewSettlement(activity, activityRecords, month, existing, today) : null;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const pauseForm = useForm<PauseValues>({
    resolver: zodResolver(pauseSchema),
    defaultValues: { startDate: today, endDate: today, reason: "vacation", notes: "" },
  });

  if (!activity) {
    return (
      <div className="space-y-4">
        <PageHeader title="Activity" description="This activity was not found." />
        <Button asChild variant="outline">
          <Link href="/daily-check">Back</Link>
        </Button>
      </div>
    );
  }

  const current = activity;
  const history = [0, 1, 2, 3, 4, 5].map((offset) => {
    const key = monthKey(addMonths(new Date(), -offset));
    return { month: key, summary: monthSummary(current, activityRecords, key, today) };
  });

  async function saveEdit(values: ActivityValues) {
    await saveActivity(
      {
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
        activeDays: values.activeDays ?? current.activeDays,
        startDate: values.startDate,
        endDate: values.endDate,
        status: current.status,
        pauses: current.pauses ?? [],
        autoCreateExpense: values.autoCreateExpense ?? current.autoCreateExpense,
        autoSettle: values.autoSettle ?? current.autoSettle,
        defaultAccountId: values.defaultAccountId,
        notes: values.notes,
      },
      current.id,
    );
    setEditOpen(false);
    toast.success("Activity updated");
  }

  return (
    <div className="space-y-6">
      <PageHeader title={activity.name} description={formatSchedule(activity)}>
        <Button variant="outline" onClick={() => setPauseOpen(true)}>
          Pause
        </Button>
        {activity.status === "paused" ? (
          <Button variant="outline" onClick={() => resumeActivity(activity.id)}>
            Resume
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{format(cursor, "MMMM yyyy")}</CardTitle>
            <div className="flex gap-1">
              <Button size="xs" variant="ghost" onClick={() => setCursor(addMonths(cursor, -1))}>
                Prev
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
                Next
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 grid grid-cols-7 text-center text-[11px] text-muted-foreground">
              {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const date = format(day, "yyyy-MM-dd");
                const status = dayStatus(activity, activityRecords, date, today);
                const inMonth = isSameMonth(day, cursor);
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => setDayTarget(date)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-xl text-xs",
                      inMonth ? "bg-muted/60 hover:bg-muted" : "text-muted-foreground/40",
                      status === "completed" && "bg-success/15 text-success",
                      status === "skipped" && "bg-muted",
                      status === "missed" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    <span>{format(day, "d")}</span>
                    <span className="text-[10px]">{inMonth ? SYMBOL[status] : ""}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">✓ completed · – skipped · • missed · ○ pending</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>This month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Expected" value={`${summary?.expectedDays ?? 0} days`} />
              <Row label="Completed" value={`${summary?.completedDays ?? 0} days`} />
              <Row label="Skipped" value={`${summary?.skippedDays ?? 0} days`} />
              <Row label="Missed" value={`${summary?.missedDays ?? 0} days`} />
              <Row label="Rate" value={`${(summary?.rate ?? 0).toFixed(1)}%`} />
              <Row
                label={`${format(cursor, "MMMM")} total`}
                value={<CurrencyDisplay amount={summary?.amount ?? 0} currency={currency} className="text-sm font-medium" />}
              />
              {streaks.current > 1 ? (
                <p className="pt-2 text-sm">
                  🔥 {streaks.current} day streak · best {streaks.best}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <DynamicIcon name={activity.icon} className="mt-0.5 size-4 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">{activity.name}</p>
                  <p>
                    <ActivityUnitPriceText activity={activity} currency={currency} className="font-medium" />
                  </p>
                  {usesQuantity(activity) ? (
                    <p className="text-muted-foreground">
                      Daily quantity {formatQuantityWithUnit(activityQuantity(activity), activity.unit, pricingLabel(activity))}
                    </p>
                  ) : null}
                  <p>
                    Today&apos;s amount{" "}
                    <CurrencyDisplay amount={occurrenceAmount(activity)} currency={currency} className="font-medium" />
                  </p>
                  <p className="text-muted-foreground">
                    {format(cursor, "MMMM")} completed {summary?.completedDays ?? 0} days
                  </p>
                  <p>
                    {format(cursor, "MMMM")} total{" "}
                    <CurrencyDisplay amount={summary?.amount ?? 0} currency={currency} className="font-medium" />
                  </p>
                  <p className="text-xs text-muted-foreground">{activity.description || activity.notes || "No notes"}</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                {provider?.name ?? activity.providerName ?? "No provider"}
                {activity.providerPhone ? ` · ${activity.providerPhone}` : ""}
              </p>
              {settlement ? (
                <div className="flex items-center justify-between pt-1">
                  <SettlementStatusBadge status={settlement.status} />
                  {settlement.due > 0 ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPayAmount(settlement.due);
                        setPayAccount(activity.defaultAccountId ?? accounts[0]?.id ?? "");
                        setPayOpen(true);
                      }}
                    >
                      Settle
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <EntityNotes
        type="activity"
        entityId={activity.id}
        entityName={activity.name}
        inlineNote={activity.notes}
        onSaveInline={async (value) => {
          const { id, createdAt, updatedAt, ...rest } = current;
          await saveActivity({ ...rest, notes: value }, id);
          toast.success("Note saved");
        }}
      />

      {provider ? (
        <EntityNotes
          type="provider"
          entityId={provider.id}
          entityName={provider.name}
          inlineNote={provider.notes || activity.providerNotes}
          title="Provider notes"
        />
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.map((item) => (
            <div key={item.month} className="flex items-center justify-between rounded-2xl bg-muted/50 px-3 py-2 text-sm">
              <span>{format(parseISO(`${item.month}-01`), "MMMM yyyy")}</span>
              <span className="text-muted-foreground">
                {item.summary.completedDays} completed · {item.summary.skippedDays} skipped ·{" "}
                <CurrencyDisplay amount={item.summary.amount} currency={currency} className="text-sm" />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
          </DialogHeader>
          <ActivityForm
            activity={activity}
            categories={categories}
            providers={providers}
            onCancel={() => setEditOpen(false)}
            onSubmit={saveEdit}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause service</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={pauseForm.handleSubmit(async (values) => {
              await pauseActivity(activity.id, values);
              setPauseOpen(false);
              toast.success("Pause added");
            })}
          >
            <Field label="From">
              <Input type="date" {...pauseForm.register("startDate")} />
            </Field>
            <Field label="To">
              <Input type="date" {...pauseForm.register("endDate")} />
            </Field>
            <Field label="Reason">
              <Select
                value={pauseForm.watch("reason")}
                onValueChange={(value) => pauseForm.setValue("reason", value as PauseValues["reason"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAUSE_REASONS.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea {...pauseForm.register("notes")} />
            </Field>
            <Button type="submit" className="w-full">
              Save pause
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(dayTarget)} onOpenChange={(open) => !open && setDayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dayTarget ? format(parseISO(dayTarget), "d MMM yyyy") : "Day"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(["completed", "skipped", "cancelled", "not_applicable"] as const).map((status) => (
              <Button
                key={status}
                variant="outline"
                onClick={async () => {
                  if (!dayTarget) return;
                  await checkIn({ activityId: activity.id, date: dayTarget, status });
                  setDayTarget(null);
                }}
              >
                {status.replace("_", " ")}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle {format(cursor, "MMMM")}</DialogTitle>
          </DialogHeader>
          <Field label="Amount">
            <Input type="number" value={payAmount} onChange={(event) => setPayAmount(Number(event.target.value))} />
          </Field>
          <Field label="Account">
            <Select value={payAccount} onValueChange={setPayAccount}>
              <SelectTrigger>
                <SelectValue />
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
          <Button
            className="w-full"
            onClick={async () => {
              try {
                await paySettlement({
                  activityId: activity.id,
                  month,
                  amount: payAmount,
                  accountId: payAccount,
                  date: todayISO(),
                  createExpense: true,
                });
                toast.success("Settlement paid");
                setPayOpen(false);
              } catch (error) {
                toast.error(getErrorMessage(error));
              }
            }}
          >
            Pay and create expense
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete activity?"
        description="History stays in records, but this activity will be removed from Daily Check."
        onConfirm={async () => {
          await removeActivity(activity.id);
          router.replace("/daily-check");
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
