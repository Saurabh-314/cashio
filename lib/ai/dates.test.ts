import { describe, expect, it } from "vitest";
import { parseDateRange, parseFlexibleDate } from "@/lib/ai/dates";

const today = new Date(2026, 7, 27);

describe("parseFlexibleDate", () => {
  it("understands relative dates", () => {
    expect(parseFlexibleDate("today", today)).toBe("2026-08-27");
    expect(parseFlexibleDate("yesterday", today)).toBe("2026-08-26");
    expect(parseFlexibleDate("tomorrow", today)).toBe("2026-08-28");
    expect(parseFlexibleDate("last Friday", today)).toBe("2026-08-21");
  });
});

describe("parseDateRange", () => {
  it("understands this month, last month, and named months", () => {
    expect(parseDateRange("this month", today).start).toBe("2026-08-01");
    expect(parseDateRange("this month", today).end).toBe("2026-08-31");
    expect(parseDateRange("last month", today).start).toBe("2026-07-01");
    expect(parseDateRange("August", today).label).toContain("August");
    expect(parseDateRange("next 7 days", today).end).toBe("2026-09-02");
  });
});
