import type { Metadata } from "next";
import { ActivityDetailView } from "@/components/daily-check/activity-detail-view";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityDetailPage({
  params,
}: PageProps<"/daily-check/[activityId]">) {
  const { activityId } = await params;
  return <ActivityDetailView activityId={activityId} />;
}
