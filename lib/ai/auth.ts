import { getSession } from "@/lib/auth/session";
import { CashioAIError } from "@/lib/ai/errors";

export async function requireAIUser() {
  const session = await getSession();
  if (!session?.uid) {
    throw new CashioAIError("unauthenticated", "Please sign in to use Cashio AI.", 401);
  }
  return session;
}
