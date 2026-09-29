import { describe, expect, it } from "vitest";
import {
  archiveEndDate,
  calculateActivityAmount,
  calculateActivityPeriodAmount,
  formatQuantityWithUnit,
  monthSummary,
  occurrenceAmount,
  pricingLabel,
  recordAmount,
  singularUnit,
  usesQuantity,
} from "@/lib/finance/activity-calculations";
import type { Activity, ActivityRecord } from "@/types";

function activity(patch: Partial<Activity>): Activity {
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
    activeDays: [1, 2, 3, 4, 5, 6],
    startDate: "2026-08-01",
    status: "active",
    pauses: [],
    autoCreateExpense: false,
    autoSettle: false,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

describe("calculateActivityAmount", () => {
  it("multiplies unit price by quantity", () => {
    expect(calculateActivityAmount({ unitPrice: 50, quantity: 3 })).toBe(150);
    expect(calculateActivityAmount({ unitPrice: 60, quantity: 2 })).toBe(120);
    expect(calculateActivityAmount({ unitPrice: 8, quantity: 6 })).toBe(48);
    expect(calculateActivityAmount({ unitPrice: 50, quantity: 1.5 })).toBe(75);
    expect(calculateActivityAmount({ unitPrice: 100, quantity: 1 })).toBe(100);
  });

  it("returns 0 for invalid values", () => {
    expect(calculateActivityAmount({ unitPrice: 0, quantity: 3 })).toBe(0);
    expect(calculateActivityAmount({ unitPrice: 50, quantity: 0 })).toBe(0);
    expect(calculateActivityAmount({ unitPrice: -10, quantity: 2 })).toBe(0);
    expect(calculateActivityAmount({ unitPrice: 50, quantity: Number.NaN })).toBe(0);
  });
});

describe("calculateActivityPeriodAmount", () => {
  it("multiplies unit price × quantity × completed days", () => {
    expect(calculateActivityPeriodAmount({ unitPrice: 50, quantity: 3, occurrences: 24 })).toBe(3600);
    expect(calculateActivityPeriodAmount({ unitPrice: 60, quantity: 2, occurrences: 25 })).toBe(3000);
  });
});

describe("occurrenceAmount", () => {
  it("keeps amount as unit price and totals separately", () => {
    const milk = activity({ amount: 50, defaultQuantity: 3, unit: "liter", pricingType: "per_unit" });
    expect(milk.amount).toBe(50);
    expect(occurrenceAmount(milk)).toBe(150);
    expect(pricingLabel(milk)).toBe("liter");
  });

  it("does not multiply monthly fixed prices by quantity", () => {
    const maid = activity({
      pricingType: "monthly",
      amount: 3000,
      unit: "month",
      defaultQuantity: 1,
      frequency: "specific_days",
    });
    expect(occurrenceAmount(maid)).toBe(3000);
    expect(usesQuantity(maid)).toBe(false);
  });

  it("does not multiply weekly fixed prices by quantity", () => {
    const weekly = activity({
      pricingType: "weekly",
      amount: 500,
      unit: "week",
      defaultQuantity: 2,
      frequency: "weekly",
    });
    expect(usesQuantity(weekly)).toBe(false);
    expect(occurrenceAmount(weekly)).toBe(500);
  });

  it("does not multiply daily fixed prices when quantity is 1", () => {
    const paper = activity({
      pricingType: "daily",
      amount: 100,
      unit: "day",
      defaultQuantity: 1,
      frequency: "daily",
    });
    expect(occurrenceAmount(paper)).toBe(100);
    expect(usesQuantity(paper)).toBe(false);
  });

  it("multiplies daily activities that have a real quantity and unit", () => {
    const milk = activity({
      pricingType: "daily",
      amount: 50,
      unit: "liter",
      defaultQuantity: 3,
    });
    expect(usesQuantity(milk)).toBe(true);
    expect(occurrenceAmount(milk)).toBe(150);
  });
});

describe("recordAmount", () => {
  it("stores the daily total without changing the unit price", () => {
    const milk = activity({ amount: 50, defaultQuantity: 3, unit: "liter", pricingType: "per_unit" });
    expect(recordAmount(milk, 3, "2026-08")).toBe(150);
    expect(milk.amount).toBe(50);
  });
});

describe("monthSummary", () => {
  function completed(date: string, quantity = 3, calculatedAmount = 150): ActivityRecord {
    return {
      id: `a1_${date}`,
      activityId: "a1",
      date,
      status: "completed",
      quantity,
      calculatedAmount,
      unitPrice: 50,
      unit: "liter",
      createdAt: "",
      updatedAt: "",
    };
  }

  it("uses unit price × quantity × completed days, not calendar days", () => {
    const milk = activity({
      amount: 50,
      defaultQuantity: 3,
      unit: "liter",
      pricingType: "per_unit",
      frequency: "specific_days",
      activeDays: [1, 2, 3, 4, 5, 6],
    });
    const dates = [
      "2026-08-01",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ];
    const summary = monthSummary(milk, dates.map((date) => completed(date)), "2026-08", "2026-08-31");
    expect(summary.expectedDays).toBe(26);
    expect(summary.completedDays).toBe(24);
    expect(summary.amount).toBe(3600);
  });

  it("keeps monthly fixed prices as a single amount", () => {
    const rent = activity({
      name: "Maid",
      pricingType: "monthly",
      amount: 3000,
      unit: "month",
      defaultQuantity: 1,
      frequency: "monthly",
      activeDays: [],
    });
    const summary = monthSummary(
      rent,
      [
        {
          id: "a1_2026-08-01",
          activityId: "a1",
          date: "2026-08-01",
          status: "completed",
          quantity: 1,
          calculatedAmount: 3000,
          createdAt: "",
          updatedAt: "",
        },
      ],
      "2026-08",
      "2026-08-31",
    );
    expect(summary.amount).toBe(3000);
  });

  it("keeps completed records after the activity is removed", () => {
    const milk = activity({
      status: "archived",
      endDate: "2026-08-15",
      frequency: "daily",
      startDate: "2026-08-01",
    });
    const dates = ["2026-08-01", "2026-08-02", "2026-08-14", "2026-08-15"];
    const summary = monthSummary(milk, dates.map((date) => completed(date)), "2026-08", "2026-08-31");
    expect(summary.expectedDays).toBe(15);
    expect(summary.completedDays).toBe(4);
    expect(summary.amount).toBe(600);
  });

  it("uses a per-day amount override", () => {
    const milk = activity({ frequency: "daily", startDate: "2026-08-01" });
    const summary = monthSummary(
      milk,
      [
        completed("2026-08-01", 2, 80),
        { ...completed("2026-08-02", 2, 80), amountOverride: 90 },
      ],
      "2026-08",
      "2026-08-02",
    );
    expect(summary.completedDays).toBe(2);
    expect(summary.amount).toBe(170);
  });
});

describe("archiveEndDate", () => {
  it("stops before today unless that day already has a check", () => {
    expect(archiveEndDate({}, "2026-09-29", false)).toBe("2026-09-28");
    expect(archiveEndDate({}, "2026-09-29", true)).toBe("2026-09-29");
    expect(archiveEndDate({ endDate: "2026-09-01" }, "2026-09-29", false)).toBe("2026-09-01");
    expect(archiveEndDate({ endDate: "2026-10-01" }, "2026-09-29", false)).toBe("2026-09-28");
  });
});

describe("unit formatting", () => {
  it("uses singular units on the unit-price label", () => {
    expect(singularUnit("liters")).toBe("liter");
    expect(pricingLabel(activity({ unit: "liters" }))).toBe("liter");
  });

  it("pluralizes quantity labels", () => {
    expect(formatQuantityWithUnit(1, "liter")).toBe("1 liter");
    expect(formatQuantityWithUnit(3, "liter")).toBe("3 liters");
    expect(formatQuantityWithUnit(1, "kg")).toBe("1 kg");
    expect(formatQuantityWithUnit(3, "kg")).toBe("3 kg");
    expect(formatQuantityWithUnit(1.5, "liter")).toBe("1.5 liters");
  });
});
