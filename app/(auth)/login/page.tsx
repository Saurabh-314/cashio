import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/auth-card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard
      mode="login"
      title="Welcome back"
      subtitle="Log in with your email and password."
    />
  );
}
