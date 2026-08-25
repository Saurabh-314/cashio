import type { ActivityFrequency, ActivityGroup, ActivityPricingType, PauseReason, SkipReason } from "@/types";

export const ACTIVITY_GROUPS: { id: ActivityGroup; label: string }[] = [
  { id: "household", label: "Household" },
  { id: "food_delivery", label: "Food & Delivery" },
  { id: "utilities", label: "Utilities" },
  { id: "health", label: "Health & Fitness" },
  { id: "education", label: "Education" },
  { id: "personal", label: "Personal Services" },
  { id: "other", label: "Other" },
];

export const PRICING_TYPES: { id: ActivityPricingType; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly fixed" },
  { id: "per_visit", label: "Per visit" },
  { id: "per_unit", label: "Per unit" },
  { id: "custom", label: "Custom" },
];

export const ACTIVITY_FREQUENCIES: { id: ActivityFrequency; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekends", label: "Weekends" },
  { id: "specific_days", label: "Specific weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Biweekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "custom", label: "Custom" },
];

export const WEEKDAYS = [
  { id: 1, short: "Mon", label: "Monday" },
  { id: 2, short: "Tue", label: "Tuesday" },
  { id: 3, short: "Wed", label: "Wednesday" },
  { id: 4, short: "Thu", label: "Thursday" },
  { id: 5, short: "Fri", label: "Friday" },
  { id: 6, short: "Sat", label: "Saturday" },
  { id: 0, short: "Sun", label: "Sunday" },
];

export const SKIP_REASONS: { id: SkipReason; label: string }[] = [
  { id: "didnt_need", label: "Didn't need it" },
  { id: "provider_unavailable", label: "Provider unavailable" },
  { id: "holiday", label: "Holiday" },
  { id: "other", label: "Other" },
];

export const PAUSE_REASONS: { id: PauseReason; label: string }[] = [
  { id: "vacation", label: "Vacation" },
  { id: "provider_holiday", label: "Provider holiday" },
  { id: "personal_holiday", label: "Personal holiday" },
  { id: "service_unavailable", label: "Service unavailable" },
  { id: "custom", label: "Custom" },
];

export interface ActivityTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  group: ActivityGroup;
  pricingType: ActivityPricingType;
  amount: number;
  unit?: string;
  defaultQuantity: number;
  frequency: ActivityFrequency;
  activeDays: number[];
  suggestedCategory: string;
}

export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    id: "milk",
    name: "Milk",
    icon: "droplets",
    color: "#5B8FA8",
    group: "food_delivery",
    pricingType: "daily",
    amount: 60,
    unit: "day",
    defaultQuantity: 1,
    frequency: "specific_days",
    activeDays: [1, 2, 3, 4, 5, 6],
    suggestedCategory: "Groceries",
  },
  {
    id: "newspaper",
    name: "Newspaper",
    icon: "newspaper",
    color: "#6D7A8A",
    group: "food_delivery",
    pricingType: "daily",
    amount: 10,
    unit: "day",
    defaultQuantity: 1,
    frequency: "daily",
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    suggestedCategory: "Miscellaneous",
  },
  {
    id: "maid",
    name: "Maid",
    icon: "sparkles",
    color: "#C97B84",
    group: "household",
    pricingType: "monthly",
    amount: 3000,
    unit: "month",
    defaultQuantity: 1,
    frequency: "specific_days",
    activeDays: [1, 2, 3, 4, 5, 6],
    suggestedCategory: "Home Maintenance",
  },
  {
    id: "internet",
    name: "Internet",
    icon: "wifi",
    color: "#5B8FA8",
    group: "utilities",
    pricingType: "monthly",
    amount: 999,
    unit: "month",
    defaultQuantity: 1,
    frequency: "monthly",
    activeDays: [],
    suggestedCategory: "Internet",
  },
  {
    id: "gym",
    name: "Gym",
    icon: "dumbbell",
    color: "#D46A6A",
    group: "health",
    pricingType: "monthly",
    amount: 1500,
    unit: "month",
    defaultQuantity: 1,
    frequency: "daily",
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    suggestedCategory: "Fitness",
  },
  {
    id: "laundry",
    name: "Laundry",
    icon: "shirt",
    color: "#7C6A9A",
    group: "household",
    pricingType: "per_visit",
    amount: 300,
    unit: "visit",
    defaultQuantity: 1,
    frequency: "weekly",
    activeDays: [],
    suggestedCategory: "Personal Care",
  },
  {
    id: "cook",
    name: "Cook",
    icon: "utensils",
    color: "#E07A5F",
    group: "household",
    pricingType: "monthly",
    amount: 4000,
    frequency: "specific_days",
    activeDays: [1, 2, 3, 4, 5, 6],
    defaultQuantity: 1,
    suggestedCategory: "Home Maintenance",
  },
  {
    id: "water",
    name: "Water delivery",
    icon: "glass-water",
    color: "#4A6FA5",
    group: "food_delivery",
    pricingType: "per_unit",
    amount: 30,
    unit: "can",
    defaultQuantity: 1,
    frequency: "custom",
    activeDays: [1, 3, 5],
    suggestedCategory: "Water",
  },
  {
    id: "driver",
    name: "Driver",
    icon: "car",
    color: "#6B8F71",
    group: "household",
    pricingType: "monthly",
    amount: 8000,
    frequency: "weekdays",
    activeDays: [1, 2, 3, 4, 5],
    defaultQuantity: 1,
    suggestedCategory: "Taxi",
  },
  {
    id: "tuition",
    name: "Tuition",
    icon: "graduation-cap",
    color: "#4A6FA5",
    group: "education",
    pricingType: "monthly",
    amount: 2500,
    frequency: "specific_days",
    activeDays: [1, 3, 5],
    defaultQuantity: 1,
    suggestedCategory: "Tuition",
  },
  {
    id: "cleaning",
    name: "House cleaning",
    icon: "brush",
    color: "#C4A484",
    group: "household",
    pricingType: "per_visit",
    amount: 500,
    unit: "visit",
    defaultQuantity: 1,
    frequency: "weekly",
    activeDays: [],
    suggestedCategory: "Home Maintenance",
  },
  {
    id: "gas",
    name: "Gas delivery",
    icon: "flame",
    color: "#E09F3E",
    group: "utilities",
    pricingType: "per_visit",
    amount: 1100,
    frequency: "monthly",
    activeDays: [],
    defaultQuantity: 1,
    suggestedCategory: "Gas",
  },
];
