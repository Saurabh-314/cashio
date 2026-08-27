import { describe, expect, it } from "vitest";
import { parseMoneyAmount, requirePositiveAmount } from "@/lib/ai/amounts";

describe("parseMoneyAmount", () => {
  it("parses short forms used in natural language", () => {
    expect(parseMoneyAmount("5k")).toBe(5000);
    expect(parseMoneyAmount("1.5k")).toBe(1500);
    expect(parseMoneyAmount("50k")).toBe(50000);
    expect(parseMoneyAmount("1L")).toBe(100000);
    expect(parseMoneyAmount("1.5L")).toBe(150000);
    expect(parseMoneyAmount("₹500")).toBe(500);
    expect(parseMoneyAmount(250)).toBe(250);
  });

  it("rejects invalid amounts", () => {
    expect(parseMoneyAmount("abc")).toBeNull();
    expect(parseMoneyAmount(0)).toBeNull();
    expect(parseMoneyAmount(-10)).toBeNull();
  });

  it("requirePositiveAmount throws for invalid values", () => {
    expect(() => requirePositiveAmount("0")).toThrow();
    expect(requirePositiveAmount("5k")).toBe(5000);
  });
});
