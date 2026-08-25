import type { Metadata } from "next";
import { PersonDetailView } from "@/components/people/person-detail-view";

export const metadata: Metadata = { title: "Person" };

export default async function PersonPage({
  params,
}: PageProps<"/people/[id]">) {
  const { id } = await params;
  return <PersonDetailView personId={id} />;
}
