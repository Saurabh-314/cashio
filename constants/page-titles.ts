export const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/dashboard", title: "Dashboard" },
  { prefix: "/transactions", title: "Transactions" },
  { prefix: "/daily-check", title: "Daily Check" },
  { prefix: "/accounts", title: "Accounts" },
  { prefix: "/people", title: "People & Udhar" },
  { prefix: "/budgets", title: "Budgets" },
  { prefix: "/goals", title: "Goals" },
  { prefix: "/loans", title: "Loans" },
  { prefix: "/bills", title: "Bills" },
  { prefix: "/reports", title: "Reports" },
  { prefix: "/categories", title: "Categories" },
  { prefix: "/settings", title: "Settings" },
  { prefix: "/recurring", title: "Recurring" },
  { prefix: "/calendar", title: "Calendar" },
  { prefix: "/investments", title: "Investments" },
  { prefix: "/onboarding", title: "Onboarding" },
];

export function titleForPath(pathname: string): string {
  const match = PAGE_TITLES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  return match?.title ?? "Cashio";
}
