import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { deleteAppUser, findAppUserByEmail } from "@/lib/auth/user-store";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }
    const body = (await request.json()) as { password?: string };
    const password = body.password ?? "";
    if (!password) {
      return NextResponse.json({ error: "Enter your password" }, { status: 400 });
    }

    const user = await findAppUserByEmail(session.email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    await deleteAppUser(session.email);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
