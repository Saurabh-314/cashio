import type { Metadata } from "next";
import { BillsView } from "@/components/bills/bills-view";

export const metadata: Metadata = { title: "Bills" };

export default function BillsPage() {
  return <BillsView />;
}
