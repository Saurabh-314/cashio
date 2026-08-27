import { NextResponse } from "next/server";
import { requireAIUser } from "@/lib/ai/auth";
import { toPublicAIError } from "@/lib/ai/errors";
import { runAIChat } from "@/lib/ai/orchestrator";

export async function POST(request: Request) {
  try {
    const session = await requireAIUser();
    const body = (await request.json()) as { message?: string; conversationId?: string };
    const data = await runAIChat({
      uid: session.uid,
      message: body.message ?? "",
      conversationId: body.conversationId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const { message, status } = toPublicAIError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
