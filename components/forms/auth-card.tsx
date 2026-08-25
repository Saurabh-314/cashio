"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/firebase/errors";

export function AuthCard({
  title,
  subtitle,
  mode,
}: {
  title: string;
  subtitle: string;
  mode: "login" | "register" | "forgot";
}) {
  const { configured, signIn, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!configured) {
      setError("Add your Firebase project keys to .env.local, then restart the app.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (mode === "register" && name.trim().length < 2) {
      setError("Enter your name");
      return;
    }
    if (mode !== "forgot" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (mode === "forgot") {
      setError("Log in, then change your password from Settings.");
      return;
    }
    setPending(true);
    try {
      if (mode === "login") await signIn(email.trim(), password);
      else await signUp(name.trim(), email.trim(), password);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
      <div className="mb-8">
        <p className="font-display text-2xl font-medium">Cashio</p>
        <p className="mt-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">Private ledger</p>
      </div>
      <h1 className="font-display text-[1.75rem] font-medium tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {mode === "register" ? (
          <Field label="Name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </Field>
        ) : null}
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        {mode !== "forgot" ? (
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          </Field>
        ) : null}
        {mode === "register" ? (
          <Field label="Confirm password">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </Field>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : mode === "register"
                ? "Create account"
                : "Send reset link"}
        </Button>
      </form>
      <div className="mt-5 space-y-2 text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            <p>
              New here?{" "}
              <Link className="text-foreground underline" href="/register">
                Register with email
              </Link>
            </p>
            <p>
              <Link className="text-foreground underline" href="/forgot-password">
                Forgot password?
              </Link>
            </p>
          </>
        ) : (
          <p>
            Already have an account?{" "}
            <Link className="text-foreground underline" href="/login">
              Log in with email
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
