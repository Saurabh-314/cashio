import { NextResponse } from "next/server";
import { confirmAIAction } from "@/lib/ai/actions";
import { requireAIUser } from "@/lib/ai/auth";
import { toPublicAIError } from "@/lib/ai/errors";

export async function POST(request: Request) {
  try {
    const session = await requireAIUser();
    const body = (await request.json()) as { actionId?: string; conversationId?: string };
    if (!body.actionId || !body.conversationId) {
      return NextResponse.json({ success: false, error: "Missing action." }, { status: 400 });
    }
    const action = await confirmAIAction(session.uid, body.actionId, body.conversationId);
    return NextResponse.json({ success: true, data: { action } });
  } catch (error) {
    const { message, status } = toPublicAIError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
