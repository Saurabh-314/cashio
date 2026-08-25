import type { CategoryKind } from "@/types";

export interface DefaultCategorySeed {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  children?: Omit<DefaultCategorySeed, "kind" | "children">[];
}

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategorySeed[] = [
  {
    name: "Housing",
    kind: "expense",
    icon: "home",
    color: "#C4A484",
    children: [
      { name: "Rent", icon: "key-round", color: "#C4A484" },
      { name: "Mortgage", icon: "landmark", color: "#C4A484" },
      { name: "Home Maintenance", icon: "hammer", color: "#C4A484" },
      { name: "Property Tax", icon: "file-text", color: "#C4A484" },
    ],
  },
  {
    name: "Food",
    kind: "expense",
    icon: "utensils",
    color: "#E07A5F",
    children: [
      { name: "Groceries", icon: "shopping-basket", color: "#E07A5F" },
      { name: "Restaurant", icon: "utensils-crossed", color: "#E07A5F" },
      { name: "Coffee", icon: "coffee", color: "#E07A5F" },
      { name: "Fast Food", icon: "sandwich", color: "#E07A5F" },
      { name: "Food Delivery", icon: "bike", color: "#E07A5F" },
    ],
  },
  {
    name: "Transportation",
    kind: "expense",
    icon: "car",
    color: "#6B8F71",
    children: [
      { name: "Fuel", icon: "fuel", color: "#6B8F71" },
      { name: "Public Transport", icon: "bus", color: "#6B8F71" },
      { name: "Taxi", icon: "car-taxi-front", color: "#6B8F71" },
      { name: "Uber", icon: "car-front", color: "#6B8F71" },
      { name: "Car Maintenance", icon: "wrench", color: "#6B8F71" },
      { name: "Parking", icon: "square-parking", color: "#6B8F71" },
    ],
  },
  {
    name: "Shopping",
    kind: "expense",
    icon: "shopping-bag",
    color: "#7C6A9A",
    children: [
      { name: "Clothing", icon: "shirt", color: "#7C6A9A" },
      { name: "Electronics", icon: "smartphone", color: "#7C6A9A" },
      { name: "Furniture", icon: "sofa", color: "#7C6A9A" },
      { name: "Personal Shopping", icon: "shopping-cart", color: "#7C6A9A" },
    ],
  },
  {
    name: "Bills & Utilities",
    kind: "expense",
    icon: "receipt",
    color: "#5B8FA8",
    children: [
      { name: "Electricity", icon: "zap", color: "#5B8FA8" },
      { name: "Water", icon: "droplets", color: "#5B8FA8" },
      { name: "Gas", icon: "flame", color: "#5B8FA8" },
      { name: "Internet", icon: "wifi", color: "#5B8FA8" },
      { name: "Mobile", icon: "phone", color: "#5B8FA8" },
      { name: "Subscriptions", icon: "repeat", color: "#5B8FA8" },
    ],
  },
  {
    name: "Health",
    kind: "expense",
    icon: "heart-pulse",
    color: "#D46A6A",
    children: [
      { name: "Doctor", icon: "stethoscope", color: "#D46A6A" },
      { name: "Medicine", icon: "pill", color: "#D46A6A" },
      { name: "Insurance", icon: "shield", color: "#D46A6A" },
      { name: "Fitness", icon: "dumbbell", color: "#D46A6A" },
    ],
  },
  {
    name: "Entertainment",
    kind: "expense",
    icon: "clapperboard",
    color: "#E09F3E",
    children: [
      { name: "Movies", icon: "film", color: "#E09F3E" },
      { name: "Games", icon: "gamepad-2", color: "#E09F3E" },
      { name: "Travel", icon: "plane", color: "#E09F3E" },
      { name: "Events", icon: "ticket", color: "#E09F3E" },
      { name: "Streaming", icon: "tv", color: "#E09F3E" },
    ],
  },
  {
    name: "Education",
    kind: "expense",
    icon: "graduation-cap",
    color: "#4A6FA5",
    children: [
      { name: "Courses", icon: "book-open", color: "#4A6FA5" },
      { name: "Books", icon: "book", color: "#4A6FA5" },
      { name: "Tuition", icon: "school", color: "#4A6FA5" },
      { name: "Training", icon: "presentation", color: "#4A6FA5" },
    ],
  },
  {
    name: "Personal",
    kind: "expense",
    icon: "sparkles",
    color: "#C97B84",
    children: [
      { name: "Haircut", icon: "scissors", color: "#C97B84" },
      { name: "Personal Care", icon: "bath", color: "#C97B84" },
      { name: "Gifts", icon: "gift", color: "#C97B84" },
    ],
  },
  {
    name: "Financial",
    kind: "expense",
    icon: "landmark",
    color: "#6D7A8A",
    children: [
      { name: "Bank Fees", icon: "badge-indian-rupee", color: "#6D7A8A" },
      { name: "Credit Card Fees", icon: "credit-card", color: "#6D7A8A" },
      { name: "Interest", icon: "percent", color: "#6D7A8A" },
      { name: "Investments", icon: "trending-up", color: "#6D7A8A" },
      { name: "Taxes", icon: "file-bar-chart", color: "#6D7A8A" },
    ],
  },
  {
    name: "Other",
    kind: "expense",
    icon: "ellipsis",
    color: "#9A8F80",
    children: [{ name: "Miscellaneous", icon: "circle-dashed", color: "#9A8F80" }],
  },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategorySeed[] = [
  { name: "Salary", kind: "income", icon: "briefcase", color: "#3D9B74" },
  { name: "Freelance", kind: "income", icon: "laptop", color: "#3D9B74" },
  { name: "Business", kind: "income", icon: "store", color: "#3D9B74" },
  { name: "Bonus", kind: "income", icon: "star", color: "#3D9B74" },
  { name: "Interest", kind: "income", icon: "percent", color: "#3D9B74" },
  { name: "Dividend", kind: "income", icon: "pie-chart", color: "#3D9B74" },
  { name: "Investment Return", kind: "income", icon: "trending-up", color: "#3D9B74" },
  { name: "Rental Income", kind: "income", icon: "building-2", color: "#3D9B74" },
  { name: "Cashback", kind: "income", icon: "rotate-ccw", color: "#3D9B74" },
  { name: "Refund", kind: "income", icon: "undo-2", color: "#3D9B74" },
  { name: "Gift", kind: "income", icon: "gift", color: "#3D9B74" },
  { name: "Other Income", kind: "income", icon: "plus-circle", color: "#3D9B74" },
];

export const ACCOUNT_COLORS = [
  "#1F2937",
  "#2F6B4F",
  "#7C6F5B",
  "#4A5568",
  "#B84A4A",
  "#5B8FA8",
  "#6D7A8A",
  "#B7791F",
];
