import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ClipboardCheck,
  Wallet,
  PiggyBank,
  Target,
  Landmark,
  Receipt,
  BarChart3,
  Tags,
  Settings,
  Repeat,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, mobile: true },
  { href: "/daily-check", label: "Daily Check", icon: ClipboardCheck, mobile: true },
  { href: "/accounts", label: "Accounts", icon: Wallet, mobile: true },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const EXTRA_NAV: NavItem[] = [
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/investments", label: "Investments", icon: TrendingUp },
];

export const MOBILE_NAV = PRIMARY_NAV.filter((item) => item.mobile);
