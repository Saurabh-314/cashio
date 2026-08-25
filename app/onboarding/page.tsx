import type { Metadata } from "next";
import { OnboardingView } from "@/components/onboarding/onboarding-view";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen px-4 py-10">
      <OnboardingView />
    </div>
  );
}
