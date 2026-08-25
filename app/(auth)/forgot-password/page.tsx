import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/auth-card";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      mode="forgot"
      title="Reset your password"
      subtitle="We’ll email you a link to choose a new password."
    />
  );
}
