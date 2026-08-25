"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DashboardSkeleton } from "@/components/shared/skeletons";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute) router.replace("/login");
    if (user && isAuthRoute) {
      router.replace(profile?.onboardingCompleted === false ? "/onboarding" : "/dashboard");
    }
    if (user && profile && !profile.onboardingCompleted && pathname !== "/onboarding" && !isAuthRoute) {
      router.replace("/onboarding");
    }
  }, [loading, user, profile, isAuthRoute, pathname, router]);

  if (loading && !isAuthRoute) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }
  if (!user && !isAuthRoute) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }
  return <>{children}</>;
}
