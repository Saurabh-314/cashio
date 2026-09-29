import { describe, expect, it } from "vitest";
import { buildCheckRecord } from "@/services/activities";
import type { Activity, ActivityRecord } from "@/types";

function activity(): Activity {
  return {
    id: "a1",
    name: "Milk",
    group: "food_delivery",
    icon: "droplets",
    color: "#000",
    pricingType: "per_unit",
    amount: 50,
    unit: "liter",
    defaultQuantity: 3,
    frequency: "daily",
    activeDays: [],
    startDate: "2026-08-01",
    status: "active",
    pauses: [],
    autoCreateExpense: false,
    autoSettle: false,
    createdAt: "",
    updatedAt: "",
  };
}

describe("buildCheckRecord", () => {
  it("stores a hand-entered amount without changing the activity rate", () => {
    const record = buildCheckRecord({
      activity: activity(),
      date: "2026-09-29",
      status: "completed",
      quantity: 2,
      amount: 80,
    });
    expect(record.quantity).toBe(2);
    expect(record.calculatedAmount).toBe(80);
    expect(record.amountOverride).toBe(80);
    expect(record.unitPrice).toBe(40);
    expect(activity().amount).toBe(50);
  });

  it("keeps an existing quantity when the check is updated without one", () => {
    const existing: ActivityRecord = {
      id: "a1_2026-09-29",
      activityId: "a1",
      date: "2026-09-29",
      status: "completed",
      quantity: 2,
      calculatedAmount: 80,
      amountOverride: 80,
      createdAt: "2026-09-29T00:00:00.000Z",
      updatedAt: "2026-09-29T00:00:00.000Z",
    };
    const record = buildCheckRecord({
      activity: activity(),
      date: "2026-09-29",
      status: "completed",
      existing,
    });
    expect(record.quantity).toBe(2);
    expect(record.amountOverride).toBe(80);
    expect(record.createdAt).toBe(existing.createdAt);
  });
});
