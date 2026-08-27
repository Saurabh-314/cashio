import { describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS, toolPermission } from "@/lib/ai/tools";
import { checkRateLimit, resetRateLimitForTests } from "@/lib/ai/rate-limit";

describe("AI tool permissions", () => {
  it("classifies read tools as read-only", () => {
    expect(toolPermission("get_account_summary")).toBe("read");
    expect(toolPermission("get_transaction_summary")).toBe("read");
    expect(toolPermission("get_net_worth")).toBe("read");
    expect(toolPermission("get_people_summary")).toBe("read");
  });

  it("requires confirmation for write tools", () => {
    expect(toolPermission("create_expense")).toBe("write");
    expect(toolPermission("create_income")).toBe("write");
    expect(toolPermission("create_transfer")).toBe("write");
    expect(toolPermission("create_lending")).toBe("write");
    expect(toolPermission("create_borrowing")).toBe("write");
    expect(toolPermission("record_repayment")).toBe("write");
    expect(toolPermission("create_daily_activity")).toBe("write");
    expect(toolPermission("create_note")).toBe("write");
    expect(toolPermission("create_bill")).toBe("write");
  });

  it("does not expose unknown tools", () => {
    expect(toolPermission("execute_sql")).toBeNull();
    expect(TOOL_DEFINITIONS.every((item) => item.permission === "read" || item.permission === "write")).toBe(true);
  });
});

describe("AI rate limit", () => {
  it("blocks after the window is exceeded", () => {
    resetRateLimitForTests();
    expect(checkRateLimit("u1", 2, 60_000, 1).ok).toBe(true);
    expect(checkRateLimit("u1", 2, 60_000, 2).ok).toBe(true);
    expect(checkRateLimit("u1", 2, 60_000, 3).ok).toBe(false);
  });
});
