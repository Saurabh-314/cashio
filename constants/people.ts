import type {
  PersonRelationship,
  UdharInterestType,
  UdharPaymentMethod,
  UdharStatus,
  UdharType,
} from "@/types";

export const PERSON_RELATIONSHIPS: { value: PersonRelationship; label: string }[] = [
  { value: "friend", label: "Friend" },
  { value: "family", label: "Family" },
  { value: "colleague", label: "Colleague" },
  { value: "neighbor", label: "Neighbor" },
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "other", label: "Other" },
];

export const UDHAR_TYPES: { value: UdharType; label: string; hint: string }[] = [
  { value: "lent", label: "I lent money", hint: "Someone owes me money." },
  { value: "borrowed", label: "I borrowed money", hint: "I owe someone money." },
];

export const UDHAR_INTEREST_TYPES: { value: UdharInterestType; label: string }[] = [
  { value: "none", label: "No interest" },
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage", label: "Percentage" },
];

export const UDHAR_PAYMENT_METHODS: { value: UdharPaymentMethod; label: string }[] = [
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

export const UDHAR_STATUS_LABELS: Record<UdharStatus, string> = {
  active: "Active",
  partially_paid: "Partially paid",
  overdue: "Overdue",
  settled: "Settled",
  cancelled: "Cancelled",
};

export function relationshipLabel(value?: PersonRelationship | string) {
  return PERSON_RELATIONSHIPS.find((item) => item.value === value)?.label ?? "Other";
}

export function personInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
