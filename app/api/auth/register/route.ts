import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { findAppUserByEmail, saveAppUser } from "@/lib/auth/user-store";
import { createUserProfile } from "@/services/users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = body.name?.trim() ?? "";
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (name.length < 2) {
      return NextResponse.json({ error: "Enter your name" }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await findAppUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const uid = randomUUID();
    const passwordHash = await hashPassword(password);
    await saveAppUser({ uid, name, email, passwordHash });
    await createUserProfile(uid, { displayName: name, email });
    await setSessionCookie({ uid, email, name });

    return NextResponse.json({
      user: { id: uid, uid, email, displayName: name },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account";
    return NextResponse.json({ error: friendlyAuthError(message) }, { status: 400 });
  }
}

function friendlyAuthError(message: string): string {
  if (/permission|PERMISSION_DENIED/i.test(message)) {
    return "Firestore rules are blocking registration. Publish the latest rules from firebase/firestore.rules.";
  }
  if (message.includes("AUTH_SECRET")) return "Server auth secret is missing. Restart the app after setting AUTH_SECRET.";
  return message.replaceAll("_", " ").toLowerCase();
}
