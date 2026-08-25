import { NextResponse } from "next/server";
import { normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { findAppUserByEmail } from "@/lib/auth/user-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!email.includes("@") || !password) {
      return NextResponse.json({ error: "Enter email and password" }, { status: 400 });
    }

    const user = await findAppUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
    }

    await setSessionCookie({ uid: user.uid, email: user.email, name: user.name });

    return NextResponse.json({
      user: { id: user.uid, uid: user.uid, email: user.email, displayName: user.name },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not log in";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
