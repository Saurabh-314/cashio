import type { Metadata } from "next";
import { DailyCheckView } from "@/components/daily-check/daily-check-view";

export const metadata: Metadata = { title: "Daily Check" };

export default function DailyCheckPage() {
  return <DailyCheckView />;
}
