import type { Account, Category, Goal, Person } from "@/types";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const CATEGORY_ALIASES: Record<string, string> = {
  lunch: "food",
  dinner: "food",
  breakfast: "food",
  meal: "food",
  meals: "food",
  khana: "food",
  grocery: "groceries",
  groceries: "groceries",
  kirana: "groceries",
  salary: "salary",
  paycheck: "salary",
  fuel: "fuel",
  petrol: "fuel",
  diesel: "fuel",
  cab: "taxi",
  uber: "uber",
  ola: "taxi",
  shopping: "shopping",
  clothes: "clothing",
  rent: "rent",
  electricity: "electricity",
  internet: "internet",
  wifi: "internet",
  mobile: "mobile",
  recharge: "mobile",
  interest: "interest",
};

function scoreName(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.startsWith(q) || q.startsWith(n)) return 80;
  if (n.includes(q) || q.includes(n)) return 60;
  return 0;
}

export function matchAccount(accounts: Account[], query?: string | null): Account | null {
  if (!query) return null;
  const live = accounts.filter((item) => !item.archived);
  const q = normalize(query);
  if (q === "cash") {
    return live.find((item) => item.kind === "cash") ?? live.find((item) => scoreName(q, item.name) > 0) ?? null;
  }
  let best: Account | null = null;
  let bestScore = 0;
  for (const account of live) {
    const score = Math.max(
      scoreName(q, account.name),
      account.bankName ? scoreName(q, account.bankName) : 0,
      account.last4 && q.includes(account.last4) ? 90 : 0,
    );
    if (score > bestScore) {
      best = account;
      bestScore = score;
    }
  }
  return bestScore >= 60 ? best : null;
}

export function matchCategory(
  categories: Category[],
  query?: string | null,
  kind?: Category["kind"],
): Category | null {
  if (!query) return null;
  const alias = CATEGORY_ALIASES[normalize(query)];
  const needle = alias ?? normalize(query);
  const pool = kind ? categories.filter((item) => item.kind === kind) : categories;
  let best: Category | null = null;
  let bestScore = 0;
  for (const category of pool) {
    const score = scoreName(needle, category.name);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return bestScore >= 60 ? best : null;
}

export function matchPerson(people: Person[], query?: string | null): Person | null {
  if (!query) return null;
  let best: Person | null = null;
  let bestScore = 0;
  for (const person of people) {
    const score = scoreName(query, person.name);
    if (score > bestScore) {
      best = person;
      bestScore = score;
    }
  }
  return bestScore >= 60 ? best : null;
}

export function matchGoal(goals: Goal[], query?: string | null): Goal | null {
  if (!query) return null;
  let best: Goal | null = null;
  let bestScore = 0;
  for (const goal of goals) {
    const score = scoreName(query, goal.name);
    if (score > bestScore) {
      best = goal;
      bestScore = score;
    }
  }
  return bestScore >= 60 ? best : null;
}

export function defaultAssetAccount(accounts: Account[], defaultAccountId?: string | null): Account | null {
  const live = accounts.filter((item) => !item.archived && item.kind !== "credit");
  if (defaultAccountId) {
    const preferred = live.find((item) => item.id === defaultAccountId);
    if (preferred) return preferred;
  }
  if (live.length === 1) return live[0];
  return live.find((item) => item.kind === "bank") ?? live[0] ?? null;
}

export function assetAccountOptions(accounts: Account[]): { id: string; name: string }[] {
  return accounts
    .filter((item) => !item.archived && item.kind !== "credit")
    .map((item) => ({ id: item.id, name: item.name }));
}
