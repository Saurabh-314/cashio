"use client";

import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  activityQuantity,
  activityUnitPrice,
  formatQuantityWithUnit,
  occurrenceAmount,
  occurrencePeriodLabel,
  pricingLabel,
  usesQuantity,
} from "@/lib/finance/activity-calculations";
import { cn } from "@/lib/utils";
import type { Activity, CurrencyCode } from "@/types";

export function ActivityUnitPriceText({
  activity,
  currency,
  className,
}: {
  activity: Pick<Activity, "amount" | "unit" | "pricingType">;
  currency: CurrencyCode;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      <CurrencyDisplay amount={activityUnitPrice(activity)} currency={currency} className={className} />/{pricingLabel(activity)}
    </span>
  );
}

export function ActivityPricingSummary({
  activity,
  currency,
  todayAmount,
  className,
}: {
  activity: Activity;
  currency: CurrencyCode;
  todayAmount?: number;
  className?: string;
}) {
  const qty = activityQuantity(activity);
  const period = occurrencePeriodLabel(activity);
  const total = todayAmount ?? occurrenceAmount(activity);
  const quantityBased = usesQuantity(activity);

  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <ActivityUnitPriceText activity={activity} currency={currency} className="font-medium" />
      </p>
      {quantityBased ? (
        <p className="text-muted-foreground">
          {formatQuantityWithUnit(qty, activity.unit, pricingLabel(activity))}/{period}
        </p>
      ) : null}
      <p>
        <CurrencyDisplay amount={total} currency={currency} className="font-medium" />
        <span className="text-muted-foreground"> {todayAmount != null ? "today" : `/${period}`}</span>
      </p>
    </div>
  );
}
