"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_FREQUENCIES,
  ACTIVITY_GROUPS,
  ACTIVITY_TEMPLATES,
  PRICING_TYPES,
  WEEKDAYS,
} from "@/constants/activities";
import { activitySchema, type ActivityValues } from "@/lib/validations";
import { todayISO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { Activity, Category, ServiceProvider } from "@/types";

const NONE = "__none";

function activeDaysForFrequency(frequency: ActivityValues["frequency"], days: number[]) {
  if (frequency === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (frequency === "weekdays") return [1, 2, 3, 4, 5];
  if (frequency === "weekends") return [0, 6];
  return days;
}

export function ActivityForm({
  activity,
  categories,
  providers,
  onSubmit,
  onCancel,
}: {
  activity?: Activity;
  categories: Category[];
  providers: ServiceProvider[];
  onSubmit: (values: ActivityValues) => Promise<void>;
  onCancel: () => void;
}) {
  const expenseCategories = categories.filter((item) => item.kind === "expense");
  const form = useForm<ActivityValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: activity
      ? {
          name: activity.name,
          group: activity.group,
          icon: activity.icon,
          color: activity.color,
          description: activity.description ?? "",
          providerId: activity.providerId ?? "",
          providerName: activity.providerName ?? "",
          providerPhone: activity.providerPhone ?? "",
          providerNotes: activity.providerNotes ?? "",
          pricingType: activity.pricingType,
          amount: activity.amount,
          unit: activity.unit ?? "",
          defaultQuantity: activity.defaultQuantity,
          frequency: activity.frequency,
          activeDays: activity.activeDays,
          startDate: activity.startDate,
          endDate: activity.endDate ?? "",
          expenseCategoryId: activity.expenseCategoryId ?? activity.categoryId ?? "",
          defaultAccountId: activity.defaultAccountId ?? "",
          autoCreateExpense: activity.autoCreateExpense,
          autoSettle: activity.autoSettle,
          notes: activity.notes ?? "",
        }
      : {
          name: "",
          group: "household",
          icon: "clipboard-check",
          color: "#1F2937",
          description: "",
          providerId: "",
          providerName: "",
          providerPhone: "",
          providerNotes: "",
          pricingType: "daily",
          amount: 0,
          unit: "day",
          defaultQuantity: 1,
          frequency: "daily",
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          startDate: todayISO(),
          endDate: "",
          expenseCategoryId: "",
          defaultAccountId: "",
          autoCreateExpense: false,
          autoSettle: false,
          notes: "",
        },
  });

  const frequency = form.watch("frequency");
  const pricingType = form.watch("pricingType");
  const days = form.watch("activeDays") ?? [];

  useEffect(() => {
    if (frequency === "daily" || frequency === "weekdays" || frequency === "weekends") {
      form.setValue("activeDays", activeDaysForFrequency(frequency, []));
    }
  }, [frequency, form]);

  function applyTemplate(id: string) {
    const template = ACTIVITY_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    const category = expenseCategories.find((item) => item.name === template.suggestedCategory);
    form.reset({
      ...form.getValues(),
      name: template.name,
      group: template.group,
      icon: template.icon,
      color: template.color,
      pricingType: template.pricingType,
      amount: template.amount,
      unit: template.unit ?? "",
      defaultQuantity: template.defaultQuantity,
      frequency: template.frequency,
      activeDays: template.activeDays.length ? template.activeDays : activeDaysForFrequency(template.frequency, []),
      expenseCategoryId: category?.id ?? "",
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          providerId: values.providerId || undefined,
          expenseCategoryId: values.expenseCategoryId || undefined,
          defaultAccountId: values.defaultAccountId || undefined,
          endDate: values.endDate || undefined,
          activeDays: activeDaysForFrequency(values.frequency, values.activeDays ?? []),
        });
      })}
    >
      {!activity ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Templates</p>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TEMPLATES.map((template) => (
              <Button key={template.id} type="button" size="xs" variant="outline" onClick={() => applyTemplate(template.id)}>
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activity name" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="Milk" />
        </Field>
        <Field label="Group">
          <Select value={form.watch("group")} onValueChange={(value) => form.setValue("group", value as ActivityValues["group"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_GROUPS.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Description">
        <Textarea rows={2} {...form.register("description")} placeholder="Optional notes about this service" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pricing">
          <Select
            value={pricingType}
            onValueChange={(value) => form.setValue("pricingType", value as ActivityValues["pricingType"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_TYPES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Amount" error={form.formState.errors.amount?.message}>
          <MoneyInput value={form.watch("amount")} onChange={(value) => form.setValue("amount", value, { shouldValidate: true })} />
        </Field>
        <Field label="Unit">
          <Input {...form.register("unit")} placeholder="day, litre, visit" />
        </Field>
        <Field label="Default quantity">
          <Input
            type="number"
            min={0}
            step="0.1"
            {...form.register("defaultQuantity", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Frequency">
          <Select
            value={frequency}
            onValueChange={(value) => form.setValue("frequency", value as ActivityValues["frequency"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_FREQUENCIES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date">
          <Input type="date" {...form.register("startDate")} />
        </Field>
      </div>

      {frequency === "specific_days" || frequency === "custom" ? (
        <Field label="Active days">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => {
              const selected = days.includes(day.id);
              return (
                <Button
                  key={day.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className={cn("min-w-10", selected && "shadow-none")}
                  onClick={() => {
                    const next = selected ? days.filter((item) => item !== day.id) : [...days, day.id];
                    form.setValue("activeDays", next);
                  }}
                >
                  {day.short}
                </Button>
              );
            })}
          </div>
        </Field>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <Select
            value={form.watch("providerId") || NONE}
            onValueChange={(value) => form.setValue("providerId", value === NONE ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No saved provider</SelectItem>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Person / service name">
          <Input {...form.register("providerName")} placeholder="Ramesh Milk Supplier" />
        </Field>
        <Field label="Phone">
          <Input {...form.register("providerPhone")} placeholder="Optional" />
        </Field>
        <Field label="Expense category">
          <Select
            value={form.watch("expenseCategoryId") || NONE}
            onValueChange={(value) => form.setValue("expenseCategoryId", value === NONE ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Uncategorized</SelectItem>
              {expenseCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm">
        Include in month-end settlement
        <Switch
          checked={Boolean(form.watch("autoSettle"))}
          onCheckedChange={(checked) => form.setValue("autoSettle", checked)}
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save activity</Button>
      </div>
    </form>
  );
}
