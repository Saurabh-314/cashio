"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSkeleton } from "@/components/shared/skeletons";

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else router.replace(profile?.onboardingCompleted === false ? "/onboarding" : "/dashboard");
  }, [loading, profile?.onboardingCompleted, router, user]);

  return (
    <div className="p-6">
      <DashboardSkeleton />
    </div>
  );
}
