import type { NoteRelatedType } from "@/types";

export const DEFAULT_NOTE_TRASH_DAYS = 30;

export const DEFAULT_NOTE_CATEGORIES = [
  { name: "Personal", icon: "user", color: "#7C6F5B" },
  { name: "Finance", icon: "wallet", color: "#2F6B4F" },
  { name: "Bills", icon: "receipt", color: "#B7791F" },
  { name: "Daily Check", icon: "clipboard-check", color: "#1F2937" },
  { name: "Shopping", icon: "shopping-bag", color: "#7C6F5B" },
  { name: "Work", icon: "briefcase", color: "#1F2937" },
  { name: "Ideas", icon: "lightbulb", color: "#B7791F" },
  { name: "Travel", icon: "plane", color: "#2F6B4F" },
  { name: "Important", icon: "bookmark", color: "#B84A4A" },
  { name: "Other", icon: "file-text", color: "#737373" },
] as const;

export const RELATED_CATEGORY_NAME: Record<NoteRelatedType, string> = {
  transaction: "Finance",
  account: "Finance",
  activity: "Daily Check",
  provider: "Daily Check",
  bill: "Bills",
  goal: "Finance",
  loan: "Finance",
};

export const RELATED_TYPE_LABEL: Record<NoteRelatedType, string> = {
  transaction: "Transaction",
  account: "Account",
  activity: "Daily Check",
  provider: "Provider",
  bill: "Bill",
  goal: "Goal",
  loan: "Loan",
};

export const NOTE_TEMPLATES = [
  {
    id: "financial-planning",
    name: "Financial Planning",
    category: "Finance",
    title: "Financial planning",
    content: `Income:

Expenses:

Savings:

Notes:
`,
  },
  {
    id: "bill-reminder",
    name: "Bill Reminder",
    category: "Bills",
    title: "Bill reminder",
    content: `Bill:

Due Date:

Expected Amount:

Notes:
`,
  },
  {
    id: "service-provider",
    name: "Service Provider",
    category: "Daily Check",
    title: "Service provider",
    content: `Provider:

Phone:

Service:

Payment:

Notes:
`,
  },
  {
    id: "shopping-list",
    name: "Shopping List",
    category: "Shopping",
    title: "Grocery",
    content: `- [ ] Item 1
- [ ] Item 2
- [ ] Item 3
`,
  },
  {
    id: "travel-planning",
    name: "Travel Planning",
    category: "Travel",
    title: "Travel planning",
    content: `Destination:

Dates:

Budget:

Things to do:

Things to buy:

Notes:
`,
  },
] as const;

export const NOTE_SORT_OPTIONS = [
  { id: "updated", label: "Recently updated" },
  { id: "created", label: "Recently created" },
  { id: "oldest", label: "Oldest" },
  { id: "az", label: "A–Z" },
  { id: "za", label: "Z–A" },
  { id: "pinned", label: "Pinned first" },
] as const;

export const ALLOWED_NOTE_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "application/rtf",
];

export const MAX_NOTE_FILE_SIZE = 10 * 1024 * 1024;
