import { formatMoney, roundMoney } from "@/lib/finance/money";
import { CashioAIError } from "@/lib/ai/errors";
import { loadFinanceSnapshot } from "@/lib/ai/data";
import {
  dailyActivityInput,
  expenseTransactionInput,
  incomeTransactionInput,
  transferTransactionInput,
} from "@/lib/ai/payloads";
import { getAction, saveAction, writeAudit, claimAction } from "@/lib/ai/store";
import type { AIActionRecord, AIActionView } from "@/lib/ai/types";
import { createNote } from "@/services/notes";
import { addDocAt, createTransaction, updateDocAt } from "@/services/transactions";
import { createPersonInline, createUdhar, recordPersonRepayment } from "@/services/udhar";
import type { Account, Person, UdharType } from "@/types";
import { nowIso } from "@/services/helpers";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function ownedAccount(accounts: Account[], id: string | undefined): Account {
  const account = accounts.find((item) => item.id === id && !item.archived);
  if (!account) throw new CashioAIError("validation", "That account was not found.", 400);
  return account;
}

export async function cancelAIAction(uid: string, actionId: string, conversationId: string): Promise<AIActionView> {
  const action = await getAction(uid, actionId);
  if (!action || action.conversationId !== conversationId) {
    throw new CashioAIError("not_found", "That action was not found.", 404);
  }
  if (action.status === "executed") {
    throw new CashioAIError("conflict", "This action was already completed.", 409);
  }
  action.status = "cancelled";
  action.display = { ...action.display, status: "cancelled" };
  action.updatedAt = nowIso();
  await saveAction(uid, action);
  await writeAudit(uid, {
    userId: uid,
    conversationId,
    actionId,
    actionType: action.actionType,
    payload: action.payload,
    status: "cancelled",
    createdAt: nowIso(),
  });
  return action.display;
}

export async function confirmAIAction(uid: string, actionId: string, conversationId: string): Promise<AIActionView> {
  const existing = await getAction(uid, actionId);
  if (!existing || existing.conversationId !== conversationId) {
    throw new CashioAIError("not_found", "That action was not found.", 404);
  }
  if (existing.status === "cancelled") {
    throw new CashioAIError("conflict", "This action was cancelled.", 409);
  }
  if (existing.status === "executed") {
    return existing.display;
  }

  let action: AIActionRecord;
  try {
    action = await claimAction(uid, actionId);
  } catch {
    const latest = await getAction(uid, actionId);
    if (latest?.status === "executed") return latest.display;
    throw new CashioAIError("conflict", "This action cannot be confirmed.", 409);
  }
  if (action.status === "executed") {
    return action.display;
  }

  try {
    const result = await executeAction(uid, action);
    action.status = "executed";
    action.executedAt = nowIso();
    action.updatedAt = nowIso();
    action.result = result.payload;
    action.display = {
      ...action.display,
      status: "executed",
      resultSummary: result.summary,
      href: result.href,
    };
    await saveAction(uid, action);
    await writeAudit(uid, {
      userId: uid,
      conversationId,
      actionId,
      actionType: action.actionType,
      payload: action.payload,
      status: "executed",
      createdAt: nowIso(),
      executedAt: action.executedAt,
    });
    return action.display;
  } catch (error) {
    action.status = "failed";
    action.error = error instanceof Error ? error.message : "Failed";
    action.updatedAt = nowIso();
    action.display = { ...action.display, status: "failed", resultSummary: action.error };
    await saveAction(uid, action);
    await writeAudit(uid, {
      userId: uid,
      conversationId,
      actionId,
      actionType: action.actionType,
      payload: action.payload,
      status: "failed",
      createdAt: nowIso(),
    });
    throw new CashioAIError("validation", action.error ?? "Could not complete that action.", 400);
  }
}

async function executeAction(
  uid: string,
  action: AIActionRecord,
): Promise<{ summary: string; href?: string; payload: Record<string, unknown> }> {
  const snapshot = await loadFinanceSnapshot(uid);
  const currency = snapshot.meta.currency;
  const payload = action.payload;
  const amount = asNumber(payload.amount);

  switch (action.actionType) {
    case "create_expense": {
      const account = ownedAccount(snapshot.accounts, asString(payload.accountId));
      const categoryId = asString(payload.categoryId) ?? null;
      if (categoryId && !snapshot.categories.some((item) => item.id === categoryId && item.kind === "expense")) {
        throw new CashioAIError("validation", "That category was not found.", 400);
      }
      const txId = await createTransaction(
        uid,
        snapshot.accounts,
        expenseTransactionInput({
          amount: amount ?? 0,
          date: asString(payload.date) ?? snapshot.meta.today,
          categoryId,
          accountId: account.id,
          description: asString(payload.description) ?? "Expense",
        }),
      );
      const next = snapshot.accounts.find((item) => item.id === account.id);
      const balance =
        next && next.kind !== "credit"
          ? roundMoney(next.currentBalance - (amount ?? 0))
          : next?.outstanding;
      return {
        summary: `Expense added · ${formatMoney(amount ?? 0, currency)}${balance != null ? ` · ${account.name} ${formatMoney(balance, currency)}` : ""}`,
        href: "/transactions",
        payload: { transactionId: txId },
      };
    }
    case "create_income": {
      const account = ownedAccount(snapshot.accounts, asString(payload.accountId));
      const categoryId = asString(payload.categoryId) ?? null;
      if (categoryId && !snapshot.categories.some((item) => item.id === categoryId && item.kind === "income")) {
        throw new CashioAIError("validation", "That category was not found.", 400);
      }
      const txId = await createTransaction(
        uid,
        snapshot.accounts,
        incomeTransactionInput({
          amount: amount ?? 0,
          date: asString(payload.date) ?? snapshot.meta.today,
          categoryId,
          accountId: account.id,
          description: asString(payload.description) ?? "Income",
        }),
      );
      return {
        summary: `Income added · ${formatMoney(amount ?? 0, currency)}`,
        href: "/transactions",
        payload: { transactionId: txId },
      };
    }
    case "create_transfer": {
      const from = ownedAccount(snapshot.accounts, asString(payload.fromAccountId));
      const to = ownedAccount(snapshot.accounts, asString(payload.toAccountId));
      const txId = await createTransaction(
        uid,
        snapshot.accounts,
        transferTransactionInput({
          amount: amount ?? 0,
          date: asString(payload.date) ?? snapshot.meta.today,
          fromAccountId: from.id,
          toAccountId: to.id,
          description: asString(payload.description) ?? `Transfer from ${from.name} to ${to.name}`,
        }),
      );
      return {
        summary: `Transferred ${formatMoney(amount ?? 0, currency)} from ${from.name} to ${to.name}`,
        href: "/transactions",
        payload: { transactionId: txId },
      };
    }
    case "create_lending":
    case "create_borrowing": {
      const account = ownedAccount(snapshot.accounts, asString(payload.accountId));
      let person: Person | undefined = snapshot.people.find((item) => item.id === asString(payload.personId));
      if (!person) {
        const newName = asString(payload.newPersonName);
        if (!newName) throw new CashioAIError("validation", "Person was not found.", 400);
        const personId = await createPersonInline(uid, { name: newName });
        person = { id: personId, name: newName, createdAt: nowIso(), updatedAt: nowIso() };
      }
      const type = (asString(payload.type) as UdharType | undefined) ?? (action.actionType === "create_lending" ? "lent" : "borrowed");
      const udharId = await createUdhar(uid, snapshot.accounts, person, {
        personId: person.id,
        type,
        principalAmount: amount ?? 0,
        date: asString(payload.date) ?? snapshot.meta.today,
        accountId: account.id,
        interestType: "none",
      });
      return {
        summary:
          type === "lent"
            ? `Lent ${formatMoney(amount ?? 0, currency)} to ${person.name}`
            : `Borrowed ${formatMoney(amount ?? 0, currency)} from ${person.name}`,
        href: `/people/${person.id}`,
        payload: { udharId, personId: person.id },
      };
    }
    case "record_repayment": {
      const person = snapshot.people.find((item) => item.id === asString(payload.personId));
      if (!person) throw new CashioAIError("validation", "Person was not found.", 400);
      const account = ownedAccount(snapshot.accounts, asString(payload.accountId));
      const type = (asString(payload.type) as UdharType | undefined) ?? "lent";
      await recordPersonRepayment({
        uid,
        accounts: snapshot.accounts,
        categories: snapshot.categories,
        person,
        udhars: snapshot.udhars,
        repayments: snapshot.udharRepayments,
        type,
        repayment: {
          amount: amount ?? 0,
          accountId: account.id,
          paymentDate: asString(payload.date) ?? snapshot.meta.today,
          paymentMethod: "bank",
        },
      });
      return {
        summary:
          type === "lent"
            ? `${person.name} repayment received · ${formatMoney(amount ?? 0, currency)}`
            : `Repayment to ${person.name} · ${formatMoney(amount ?? 0, currency)}`,
        href: `/people/${person.id}`,
        payload: { personId: person.id },
      };
    }
    case "create_daily_activity": {
      const unitPrice = asNumber(payload.unitPrice);
      const quantity = asNumber(payload.quantity) ?? 1;
      if (unitPrice == null || unitPrice <= 0) throw new CashioAIError("validation", "Unit price is required.", 400);
      const activity = dailyActivityInput({
        name: asString(payload.name) ?? "Activity",
        unitPrice,
        quantity,
        unit: asString(payload.unit) ?? "unit",
        startDate: asString(payload.startDate) ?? snapshot.meta.today,
      });
      if (activity.amount !== unitPrice) {
        throw new CashioAIError("validation", "Unit price must remain the unit price.", 400);
      }
      const id = await addDocAt(uid, "activities", activity);
      return {
        summary: `${activity.name} · ${formatMoney(unitPrice, currency)}/${activity.unit} × ${quantity}`,
        href: `/daily-check/${id}`,
        payload: { activityId: id, unitPrice, quantity },
      };
    }
    case "create_note": {
      const id = await createNote(uid, {
        title: asString(payload.title) ?? "Note",
        content: asString(payload.content) ?? "",
        tags: ["ai"],
        isPinned: false,
        isArchived: false,
      });
      return {
        summary: "Note saved",
        href: `/notes/${id}`,
        payload: { noteId: id },
      };
    }
    case "create_bill": {
      const id = await addDocAt(uid, "bills", {
        name: asString(payload.name) ?? "Bill",
        amount: amount ?? 0,
        dueDate: asString(payload.dueDate) ?? snapshot.meta.today,
        accountId: asString(payload.accountId),
        frequency: "monthly",
        reminderDays: 3,
        autoRecurring: false,
      });
      return {
        summary: `Bill added · ${asString(payload.name) ?? "Bill"}`,
        href: "/bills",
        payload: { billId: id },
      };
    }
    case "create_goal_contribution": {
      const goal = snapshot.goals.find((item) => item.id === asString(payload.goalId));
      if (!goal) throw new CashioAIError("validation", "Goal was not found.", 400);
      const fromAccountId = asString(payload.accountId);
      if (fromAccountId && goal.accountId && fromAccountId !== goal.accountId) {
        ownedAccount(snapshot.accounts, fromAccountId);
        await createTransaction(uid, snapshot.accounts, {
          type: "transfer",
          amount: amount ?? 0,
          date: snapshot.meta.today,
          description: `Contribution to ${goal.name}`,
          categoryId: null,
          accountId: null,
          fromAccountId,
          toAccountId: goal.accountId,
          tags: ["goal", "ai"],
          attachments: [],
          isCreditCardPayment: false,
          status: "cleared",
          goalId: goal.id,
        });
      } else {
        await updateDocAt(uid, "goals", goal.id, {
          currentAmount: roundMoney(goal.currentAmount + (amount ?? 0)),
        });
      }
      return {
        summary: `Saved ${formatMoney(amount ?? 0, currency)} toward ${goal.name}`,
        href: "/goals",
        payload: { goalId: goal.id },
      };
    }
    default:
      throw new CashioAIError("validation", "Unsupported action.", 400);
  }
}
