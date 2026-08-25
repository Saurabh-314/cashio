import type { Metadata } from "next";
import { Suspense } from "react";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { TableSkeleton } from "@/components/shared/skeletons";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TransactionsView />
    </Suspense>
  );
}
