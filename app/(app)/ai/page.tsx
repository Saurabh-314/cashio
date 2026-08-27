import type { Metadata } from "next";
import { AiChat } from "@/components/ai/ai-chat";

export const metadata: Metadata = { title: "Cashio AI" };

export default function AiPage() {
  return <AiChat />;
}
