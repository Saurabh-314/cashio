import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/auth-card";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      mode="register"
      title="Create your Cashio account"
      subtitle="Register with your name, email, and password."
    />
  );
}
