import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils/dates";
import { requirePositiveAmount } from "@/lib/ai/amounts";
import { parseFlexibleDate } from "@/lib/ai/dates";
import {
  canAfford,
  getAccountSummary,
  getBillSummary,
  getBudgetSummary,
  getCategorySpending,
  getDailyCheckSummary,
  getFinancialHealth,
  getGoalSummary,
  getLoanSummary,
  getMonthlyReview,
  getNetWorthSummary,
  getPeopleSummary,
  getTransactionSummary,
  getTransactions,
  getUdharSummary,
  getUpcomingCommitments,
  getWeeklyReview,
  resolveRange,
  suggestSpendingCuts,
} from "@/lib/ai/context";
import type { FinanceSnapshot } from "@/lib/ai/data";
import { assetAccountOptions, defaultAssetAccount, matchAccount, matchCategory, matchGoal, matchPerson } from "@/lib/ai/match";
import { dailyActivityInput, dailyActivityTotals } from "@/lib/ai/payloads";
import { isOpenUdhar, liveUdhars } from "@/lib/finance/udhar";
import { nowIso } from "@/services/helpers";
import { createAction, saveAction, writeAudit } from "@/lib/ai/store";
import type { AIActionType, AIActionView, AIToolDefinition, AIToolName } from "@/lib/ai/types";
import type { UdharType } from "@/types";

export const TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: "get_account_summary",
    permission: "read",
    description: "Get the user's accounts and current balances.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_transaction_summary",
    permission: "read",
    description: "Get income, expenses, and savings for a period such as this month, last month, or August.",
    parameters: {
      type: "object",
      properties: { period: { type: "string", description: "this month, last month, this week, August, etc." } },
      additionalProperties: false,
    },
  },
  {
    name: "get_transactions",
    permission: "read",
    description: "List recent transactions in a period, optionally filtered by category name.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string" },
        category: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_category_spending",
    permission: "read",
    description: "Break down expenses by category for a period.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_budget_summary",
    permission: "read",
    description: "Compare budgets with actual spending.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_goal_summary",
    permission: "read",
    description: "Show savings goals, progress, and required monthly contribution.",
    parameters: { type: "object", properties: { name: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "get_bill_summary",
    permission: "read",
    description: "Show bills, due dates, and overdue items.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_loan_summary",
    permission: "read",
    description: "Show loans and remaining balances.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_people_summary",
    permission: "read",
    description: "Show who owes the user and whom the user owes.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_udhar_summary",
    permission: "read",
    description: "Show open udhar records, optionally for one person.",
    parameters: {
      type: "object",
      properties: { person: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_daily_check_summary",
    permission: "read",
    description: "Summarize Daily Check activity costs for a month.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_net_worth",
    permission: "read",
    description: "Calculate net worth using Cashio's existing logic.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_upcoming_commitments",
    permission: "read",
    description: "List bills, loan EMIs, credit card dues, and udhar repayments in a window.",
    parameters: {
      type: "object",
      properties: { period: { type: "string", description: "next 7 days, this week, etc." } },
      additionalProperties: false,
    },
  },
  {
    name: "get_monthly_review",
    permission: "read",
    description: "Generate a monthly financial review.",
    parameters: {
      type: "object",
      properties: { period: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_weekly_review",
    permission: "read",
    description: "Generate a weekly financial review.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_financial_health",
    permission: "read",
    description: "Return an informational Cashio financial health score. Not professional advice.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "can_afford",
    permission: "read",
    description: "Analyze whether the user can afford a purchase using available cash and upcoming obligations.",
    parameters: {
      type: "object",
      properties: { amount: { type: "string", description: "Amount such as 30000 or 30k" } },
      required: ["amount"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_spending_cuts",
    permission: "read",
    description: "Suggest categories to reduce to hit a savings target. Does not change anything.",
    parameters: {
      type: "object",
      properties: { amount: { type: "string" } },
      required: ["amount"],
      additionalProperties: false,
    },
  },
  {
    name: "create_expense",
    permission: "write",
    description: "Propose an expense. Requires confirmation. Use for spending, not lending or transfers.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string" },
        category: { type: "string" },
        account: { type: "string" },
        date: { type: "string" },
        description: { type: "string" },
      },
      required: ["amount"],
      additionalProperties: false,
    },
  },
  {
    name: "create_income",
    permission: "write",
    description: "Propose income such as salary. Requires confirmation. Do not use for borrowed money.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string" },
        category: { type: "string" },
        account: { type: "string" },
        date: { type: "string" },
        description: { type: "string" },
      },
      required: ["amount"],
      additionalProperties: false,
    },
  },
  {
    name: "create_transfer",
    permission: "write",
    description: "Propose a transfer between accounts. Not income or expense. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string" },
        fromAccount: { type: "string" },
        toAccount: { type: "string" },
        date: { type: "string" },
      },
      required: ["amount", "fromAccount", "toAccount"],
      additionalProperties: false,
    },
  },
  {
    name: "create_lending",
    permission: "write",
    description: "Propose money lent to a person. Not an expense. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string" },
        person: { type: "string" },
        account: { type: "string" },
        date: { type: "string" },
      },
      required: ["amount", "person"],
      additionalProperties: false,
    },
  },
  {
    name: "create_borrowing",
    permission: "write",
    description: "Propose money borrowed from a person. Not income. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string" },
        person: { type: "string" },
        account: { type: "string" },
        date: { type: "string" },
      },
      required: ["amount", "person"],
      additionalProperties: false,
    },
  },
  {
    name: "record_repayment",
    permission: "write",
    description: "Propose an udhar repayment received or made. Not income or expense except for interest. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string" },
        person: { type: "string" },
        direction: { type: "string", enum: ["received", "made"] },
        account: { type: "string" },
        date: { type: "string" },
      },
      required: ["amount", "person", "direction"],
      additionalProperties: false,
    },
  },
  {
    name: "create_daily_activity",
    permission: "write",
    description: "Propose a Daily Check activity. amount is unit price, quantity is separate. dailyTotal = unitPrice × quantity.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        unitPrice: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string" },
        startDate: { type: "string" },
        frequency: { type: "string" },
      },
      required: ["name", "unitPrice"],
      additionalProperties: false,
    },
  },
  {
    name: "create_note",
    permission: "write",
    description: "Propose a note. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "create_bill",
    permission: "write",
    description: "Propose a bill. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "string" },
        dueDate: { type: "string" },
        account: { type: "string" },
      },
      required: ["name", "amount", "dueDate"],
      additionalProperties: false,
    },
  },
  {
    name: "create_goal_contribution",
    permission: "write",
    description: "Propose a contribution to an existing savings goal. Requires confirmation. Does not create a new goal.",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string" },
        amount: { type: "string" },
        account: { type: "string" },
      },
      required: ["goal", "amount"],
      additionalProperties: false,
    },
  },
];

export function toolPermission(name: string): "read" | "write" | null {
  return TOOL_DEFINITIONS.find((item) => item.name === name)?.permission ?? null;
}

function argsOf(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function ask(question: string, options?: string[]) {
  return { status: "needs_input" as const, question, options };
}

function field(label: string, value: string) {
  return { label, value };
}

export interface ToolExecution {
  content: string;
  action?: AIActionView;
}

function json(value: unknown) {
  return JSON.stringify(value);
}

export async function executeTool(input: {
  uid: string;
  conversationId: string;
  name: string;
  arguments: string;
  snapshot: FinanceSnapshot;
}): Promise<ToolExecution> {
  const permission = toolPermission(input.name);
  if (!permission) {
    return { content: json({ error: "Unknown tool" }) };
  }

  const args = argsOf(input.arguments);
  const snapshot = input.snapshot;
  const currency = snapshot.meta.currency;
  const today = new Date(`${snapshot.meta.today}T00:00:00`);

  if (permission === "read") {
    const result = runReadTool(input.name as AIToolName, args, snapshot);
    await writeAudit(input.uid, {
      userId: input.uid,
      conversationId: input.conversationId,
      actionType: input.name,
      payload: args,
      status: "read",
      createdAt: nowIso(),
    });
    return { content: json(result) };
  }

  const proposed = await proposeWriteTool({
    uid: input.uid,
    conversationId: input.conversationId,
    name: input.name as AIActionType,
    args,
    snapshot,
    currency,
    today,
  });
  return proposed;
}

function runReadTool(name: AIToolName, args: Record<string, unknown>, snapshot: FinanceSnapshot): unknown {
  const period = str(args.period);
  switch (name) {
    case "get_account_summary":
      return getAccountSummary(snapshot);
    case "get_transaction_summary":
      return getTransactionSummary(snapshot, resolveRange(snapshot, period));
    case "get_transactions":
      return getTransactions(snapshot, resolveRange(snapshot, period), str(args.category));
    case "get_category_spending":
      return getCategorySpending(snapshot, resolveRange(snapshot, period));
    case "get_budget_summary":
      return getBudgetSummary(snapshot);
    case "get_goal_summary": {
      const all = getGoalSummary(snapshot);
      const wanted = str(args.name)?.toLowerCase();
      if (!wanted) return all;
      return { goals: all.goals.filter((item) => item.name.toLowerCase().includes(wanted)) };
    }
    case "get_bill_summary":
      return getBillSummary(snapshot);
    case "get_loan_summary":
      return getLoanSummary(snapshot);
    case "get_people_summary":
      return getPeopleSummary(snapshot);
    case "get_udhar_summary":
      return getUdharSummary(snapshot, str(args.person));
    case "get_daily_check_summary": {
      const range = resolveRange(snapshot, period);
      return getDailyCheckSummary(snapshot, range.start.slice(0, 7));
    }
    case "get_net_worth":
      return getNetWorthSummary(snapshot);
    case "get_upcoming_commitments":
      return getUpcomingCommitments(snapshot, resolveRange(snapshot, period ?? "next 7 days"));
    case "get_monthly_review":
      return getMonthlyReview(snapshot, resolveRange(snapshot, period ?? "this month"));
    case "get_weekly_review":
      return getWeeklyReview(snapshot);
    case "get_financial_health":
      return getFinancialHealth(snapshot);
    case "can_afford":
      return canAfford(snapshot, requirePositiveAmount(str(args.amount) ?? num(args.amount)));
    case "suggest_spending_cuts":
      return suggestSpendingCuts(snapshot, requirePositiveAmount(str(args.amount) ?? num(args.amount)));
    default:
      return { error: "Unsupported read tool" };
  }
}

async function proposeWriteTool(input: {
  uid: string;
  conversationId: string;
  name: AIActionType;
  args: Record<string, unknown>;
  snapshot: FinanceSnapshot;
  currency: FinanceSnapshot["meta"]["currency"];
  today: Date;
}): Promise<ToolExecution> {
  const { snapshot, currency, today, name, args } = input;
  const dateFormat = snapshot.meta.dateFormat;

  try {
    if (name === "create_expense" || name === "create_income") {
      const amount = requirePositiveAmount(str(args.amount) ?? num(args.amount));
      const kind = name === "create_expense" ? "expense" : "income";
      const category = matchCategory(snapshot.categories, str(args.category), kind);
      const account =
        matchAccount(snapshot.accounts, str(args.account)) ??
        defaultAssetAccount(snapshot.accounts, snapshot.profile?.defaultAccountId);
      if (!account) {
        const options = assetAccountOptions(snapshot.accounts).map((item) => item.name);
        if (!options.length) return { content: json(ask("Add an account first before recording this.")) };
        return { content: json(ask("Which account should I use?", options)) };
      }
      if (str(args.account) && !matchAccount(snapshot.accounts, str(args.account))) {
        return {
          content: json(ask("I could not match that account. Which one?", assetAccountOptions(snapshot.accounts).map((item) => item.name))),
        };
      }
      if (kind === "expense" && str(args.description)) {
        const maybePerson = matchPerson(snapshot.people, str(args.description));
        if (maybePerson) {
          const open = liveUdhars(snapshot.udhars, snapshot.udharRepayments, snapshot.meta.today).filter(
            (item) => item.personId === maybePerson.id && isOpenUdhar(item),
          );
          if (open.length) {
            return {
              content: json(
                ask(`Is this a repayment of ${maybePerson.name}'s udhar, or a regular expense?`, [
                  "Udhar repayment",
                  "Regular expense",
                ]),
              ),
            };
          }
        }
      }
      const date = parseFlexibleDate(str(args.date), today) ?? snapshot.meta.today;
      const description =
        str(args.description) ??
        (kind === "income" ? category?.name ?? "Income" : category?.name ?? "Expense");
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: kind === "income" ? "Add income" : "Add expense",
        summary: `${formatMoney(amount, currency)} · ${category?.name ?? "Uncategorized"}`,
        requiresConfirmation: true,
        fields: [
          field("Amount", formatMoney(amount, currency)),
          field("Category", category?.name ?? "Uncategorized"),
          field("Account", account.name),
          field("Date", formatDate(date, dateFormat)),
        ],
      };
      const record = await persistAction(input, display, {
        amount,
        categoryId: category?.id ?? null,
        accountId: account.id,
        date,
        description,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "create_transfer") {
      const amount = requirePositiveAmount(str(args.amount) ?? num(args.amount));
      const from = matchAccount(snapshot.accounts, str(args.fromAccount));
      const to = matchAccount(snapshot.accounts, str(args.toAccount));
      if (!from || !to) {
        return {
          content: json(
            ask("Which accounts should I transfer between?", assetAccountOptions(snapshot.accounts).map((item) => item.name)),
          ),
        };
      }
      if (from.id === to.id) return { content: json({ error: "Choose two different accounts." }) };
      const date = parseFlexibleDate(str(args.date), today) ?? snapshot.meta.today;
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: "Transfer",
        summary: `${formatMoney(amount, currency)} from ${from.name} to ${to.name}`,
        requiresConfirmation: true,
        fields: [
          field("Amount", formatMoney(amount, currency)),
          field("From", from.name),
          field("To", to.name),
          field("Date", formatDate(date, dateFormat)),
        ],
      };
      const record = await persistAction(input, display, {
        amount,
        fromAccountId: from.id,
        toAccountId: to.id,
        date,
        description: `Transfer from ${from.name} to ${to.name}`,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "create_lending" || name === "create_borrowing") {
      const amount = requirePositiveAmount(str(args.amount) ?? num(args.amount));
      const personName = str(args.person);
      if (!personName) return { content: json(ask("Who is this with?")) };
      const person = matchPerson(snapshot.people, personName);
      const account =
        matchAccount(snapshot.accounts, str(args.account)) ??
        defaultAssetAccount(snapshot.accounts, snapshot.profile?.defaultAccountId);
      if (!str(args.account) && assetAccountOptions(snapshot.accounts).length > 1 && !snapshot.profile?.defaultAccountId) {
        return {
          content: json(ask("Which account did you use?", assetAccountOptions(snapshot.accounts).map((item) => item.name))),
        };
      }
      if (!account) {
        return {
          content: json(ask("Which account did you use?", assetAccountOptions(snapshot.accounts).map((item) => item.name))),
        };
      }
      const date = parseFlexibleDate(str(args.date), today) ?? snapshot.meta.today;
      const type: UdharType = name === "create_lending" ? "lent" : "borrowed";
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: type === "lent" ? "Lend money" : "Borrow money",
        summary: `${person?.name ?? personName} · ${formatMoney(amount, currency)}`,
        requiresConfirmation: true,
        fields: [
          field("Person", person?.name ?? personName),
          field("Type", type === "lent" ? "Lent" : "Borrowed"),
          field("Amount", formatMoney(amount, currency)),
          field("Account", account.name),
          field("Date", formatDate(date, dateFormat)),
        ],
      };
      const record = await persistAction(input, display, {
        amount,
        personId: person?.id ?? null,
        newPersonName: person ? undefined : personName,
        accountId: account.id,
        date,
        type,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "record_repayment") {
      const amount = requirePositiveAmount(str(args.amount) ?? num(args.amount));
      const personName = str(args.person);
      const direction = str(args.direction) === "made" ? "made" : "received";
      const person = matchPerson(snapshot.people, personName);
      if (!person) return { content: json(ask("I could not find that person. What is their name in Cashio?")) };
      const type: UdharType = direction === "received" ? "lent" : "borrowed";
      const open = liveUdhars(snapshot.udhars, snapshot.udharRepayments, snapshot.meta.today).filter(
        (item) => item.personId === person.id && item.type === type && isOpenUdhar(item),
      );
      if (!open.length) {
        return {
          content: json({
            error: `There is no open ${type === "lent" ? "receivable" : "payable"} with ${person.name}.`,
          }),
        };
      }
      const account =
        matchAccount(snapshot.accounts, str(args.account)) ??
        defaultAssetAccount(snapshot.accounts, snapshot.profile?.defaultAccountId);
      if (!account) {
        return {
          content: json(ask("Which account?", assetAccountOptions(snapshot.accounts).map((item) => item.name))),
        };
      }
      const outstanding = open.reduce((sum, item) => sum + item.outstandingAmount, 0);
      if (amount > outstanding) {
        return { content: json({ error: `Only ${formatMoney(outstanding, currency)} is outstanding with ${person.name}.` }) };
      }
      const date = parseFlexibleDate(str(args.date), today) ?? snapshot.meta.today;
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: direction === "received" ? `${person.name} repayment received` : `Repayment to ${person.name}`,
        summary: formatMoney(amount, currency),
        requiresConfirmation: true,
        fields: [
          field("Person", person.name),
          field("Amount", formatMoney(amount, currency)),
          field("Account", account.name),
          field("Date", formatDate(date, dateFormat)),
        ],
      };
      const record = await persistAction(input, display, {
        amount,
        personId: person.id,
        type,
        accountId: account.id,
        date,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "create_daily_activity") {
      const unitPrice = requirePositiveAmount(str(args.unitPrice) ?? num(args.unitPrice) ?? str(args.amount));
      const quantity = num(args.quantity) && (num(args.quantity) as number) > 0 ? (num(args.quantity) as number) : 1;
      const totals = dailyActivityTotals(unitPrice, quantity);
      const startDate = parseFlexibleDate(str(args.startDate), today) ?? snapshot.meta.today;
      const activityName = str(args.name) ?? "Activity";
      const unit = str(args.unit) ?? "unit";
      const preview = dailyActivityInput({
        name: activityName,
        unitPrice: totals.unitPrice,
        quantity: totals.quantity,
        unit,
        startDate,
      });
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: "Create Daily Check activity",
        summary: `${activityName} · ${formatMoney(totals.unitPrice, currency)}/${unit} × ${totals.quantity} = ${formatMoney(totals.dailyTotal, currency)}/day`,
        requiresConfirmation: true,
        fields: [
          field("Activity", activityName),
          field("Unit price", `${formatMoney(totals.unitPrice, currency)}/${unit}`),
          field("Quantity", `${totals.quantity} ${unit}${totals.quantity === 1 ? "" : "s"}/day`),
          field("Daily total", formatMoney(totals.dailyTotal, currency)),
          field("Start", formatDate(startDate, dateFormat)),
        ],
      };
      const record = await persistAction(input, display, {
        name: preview.name,
        unitPrice: preview.amount,
        quantity: preview.defaultQuantity,
        unit: preview.unit,
        startDate,
        frequency: preview.frequency,
        group: preview.group,
        pricingType: preview.pricingType,
        icon: preview.icon,
        color: preview.color,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "create_note") {
      const title = str(args.title);
      if (!title) return { content: json(ask("What should the note be titled?")) };
      const content = str(args.content) ?? "";
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: "Create note",
        summary: title,
        requiresConfirmation: true,
        fields: [field("Title", title), ...(content ? [field("Details", content.slice(0, 140))] : [])],
      };
      const record = await persistAction(input, display, { title, content });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "create_bill") {
      const amount = requirePositiveAmount(str(args.amount) ?? num(args.amount));
      const billName = str(args.name);
      const dueDate = parseFlexibleDate(str(args.dueDate), today);
      if (!billName || !dueDate) return { content: json(ask("I need a bill name and due date.")) };
      const account = matchAccount(snapshot.accounts, str(args.account));
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: "Add bill",
        summary: `${billName} · ${formatMoney(amount, currency)}`,
        requiresConfirmation: true,
        fields: [
          field("Bill", billName),
          field("Amount", formatMoney(amount, currency)),
          field("Due", formatDate(dueDate, dateFormat)),
          ...(account ? [field("Account", account.name)] : []),
        ],
      };
      const record = await persistAction(input, display, {
        name: billName,
        amount,
        dueDate,
        accountId: account?.id,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    if (name === "create_goal_contribution") {
      const amount = requirePositiveAmount(str(args.amount) ?? num(args.amount));
      const goal = matchGoal(snapshot.goals, str(args.goal));
      if (!goal) return { content: json(ask("Which goal?", snapshot.goals.map((item) => item.name))) };
      const account = matchAccount(snapshot.accounts, str(args.account));
      const display: Omit<AIActionView, "id" | "status"> = {
        type: name,
        title: `Contribute to ${goal.name}`,
        summary: formatMoney(amount, currency),
        requiresConfirmation: true,
        fields: [
          field("Goal", goal.name),
          field("Amount", formatMoney(amount, currency)),
          ...(account ? [field("From", account.name)] : []),
        ],
      };
      const record = await persistAction(input, display, {
        goalId: goal.id,
        amount,
        accountId: account?.id,
      });
      return { content: json({ status: "needs_confirmation", preview: record.display }), action: record.display };
    }

    return { content: json({ error: "Unsupported action" }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare that action.";
    return { content: json({ error: message }) };
  }
}

async function persistAction(
  input: { uid: string; conversationId: string; name: AIActionType },
  display: Omit<AIActionView, "id" | "status">,
  payload: Record<string, unknown>,
) {
  const stamp = nowIso();
  const record = await createAction(input.uid, {
    userId: input.uid,
    conversationId: input.conversationId,
    actionType: input.name,
    payload,
    display: { ...display, id: "pending", status: "pending" },
    status: "pending",
    createdAt: stamp,
    updatedAt: stamp,
  });
  record.display = { ...display, id: record.id, status: "pending" };
  await saveAction(input.uid, record);
  await writeAudit(input.uid, {
    userId: input.uid,
    conversationId: input.conversationId,
    actionId: record.id,
    actionType: input.name,
    payload,
    status: "proposed",
    createdAt: stamp,
  });
  return record;
}
