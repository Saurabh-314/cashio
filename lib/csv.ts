import { csvRowSchema } from "@/lib/validations";
import type { Account, Category, Transaction, TransactionType } from "@/types";

export interface CsvPreviewRow {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  account?: string;
  valid: boolean;
  error?: string;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(text: string): CsvPreviewRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const index = {
    date: headers.findIndex((h) => h.includes("date")),
    description: headers.findIndex((h) => h.includes("desc") || h.includes("narration") || h.includes("name")),
    amount: headers.findIndex((h) => h.includes("amount") || h.includes("value")),
    type: headers.findIndex((h) => h.includes("type")),
    category: headers.findIndex((h) => h.includes("category")),
    account: headers.findIndex((h) => h.includes("account")),
  };

  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const raw = {
      date: cols[index.date] ?? "",
      description: cols[index.description] ?? "",
      amount: Number.parseFloat(cols[index.amount] ?? "") || 0,
      type: (cols[index.type] ?? "expense").toLowerCase(),
      category: index.category >= 0 ? cols[index.category] : "",
      account: index.account >= 0 ? cols[index.account] : "",
    };
    const parsed = csvRowSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        date: raw.date,
        description: raw.description,
        amount: Number(raw.amount) || 0,
        type: "expense" as const,
        category: raw.category,
        account: raw.account,
        valid: false,
        error: parsed.error.issues[0]?.message ?? "Invalid row",
      };
    }
    return { ...parsed.data, valid: true };
  });
}

export function transactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
): string {
  const header = "Date,Description,Amount,Type,Category,Account,Merchant,Notes";
  const lines = transactions.map((tx) => {
    const category = categories.find((item) => item.id === tx.categoryId)?.name ?? "";
    const account =
      accounts.find((item) => item.id === (tx.accountId ?? tx.fromAccountId))?.name ?? "";
    const cells = [
      tx.date,
      tx.description,
      String(tx.amount),
      tx.type,
      category,
      account,
      tx.merchant ?? "",
      tx.notes ?? "",
    ].map((cell) => `"${cell.replaceAll('"', '""')}"`);
    return cells.join(",");
  });
  return [header, ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string, type = "text/csv"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
