"use client";

import { onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { getErrorMessage } from "@/lib/firebase/errors";
import { userDoc } from "@/services/helpers";
import type { UserProfile } from "@/types";

export interface AuthUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  configured: boolean;
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readApiError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Request failed";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as { user?: AuthUser | null };
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const unsub = onSnapshot(userDoc(user.uid), (snap) => {
      if (snap.exists()) {
        setProfile({ id: snap.id, ...(snap.data() as Omit<UserProfile, "id">) });
      }
    });
    return unsub;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      user,
      profile,
      loading,
      async signIn(email, password) {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as { user: AuthUser };
        setUser(data.user);
      },
      async signUp(name, email, password) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as { user: AuthUser };
        setUser(data.user);
      },
      async resetPassword() {
        throw new Error("Password reset is available from Settings after you log in.");
      },
      async changePassword(currentPassword, newPassword) {
        const res = await fetch("/api/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
      },
      async deleteAccount(password) {
        const res = await fetch("/api/auth/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
        setUser(null);
        setProfile(null);
      },
      async logout() {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setProfile(null);
      },
    }),
    [configured, user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { getErrorMessage };
