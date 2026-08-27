import { AI_CONFIG } from "@/lib/ai/config";
import { CashioAIError, USER_UNAVAILABLE_MESSAGE } from "@/lib/ai/errors";
import { directoryForPrompt, loadFinanceSnapshot } from "@/lib/ai/data";
import { getAIProvider } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { addMessage, createConversation, getConversation, listRecentMessages } from "@/lib/ai/store";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/ai/tools";
import type { AIActionView, AIChatSuccess, AIProviderMessage } from "@/lib/ai/types";

function conversationTitle(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 72) || "Cashio AI";
}

export async function runAIChat(input: {
  uid: string;
  message: string;
  conversationId?: string;
}): Promise<AIChatSuccess["data"]> {
  const text = input.message.replace(/\s+/g, " ").trim();
  if (!text) {
    throw new CashioAIError("invalid_request", "Enter a message.", 400);
  }
  if (text.length > 4000) {
    throw new CashioAIError("invalid_request", "That message is too long.", 400);
  }

  const limited = checkRateLimit(input.uid, AI_CONFIG.rateLimit.maxRequests, AI_CONFIG.rateLimit.windowMs);
  if (!limited.ok) {
    throw new CashioAIError("rate_limited", "Too many AI requests. Please wait a moment and try again.", 429);
  }

  let conversationId = input.conversationId;
  if (conversationId) {
    const existing = await getConversation(input.uid, conversationId);
    if (!existing) throw new CashioAIError("not_found", "Conversation was not found.", 404);
  } else {
    const created = await createConversation(input.uid, conversationTitle(text));
    conversationId = created.id;
  }

  const snapshot = await loadFinanceSnapshot(input.uid);
  const history = await listRecentMessages(input.uid, conversationId);
  await addMessage(input.uid, conversationId, { role: "user", content: text });

  const messages: AIProviderMessage[] = [
    { role: "system", content: buildSystemPrompt(directoryForPrompt(snapshot)) },
    ...history.map((item) => ({ role: item.role, content: item.content }) as AIProviderMessage),
    { role: "user", content: text },
  ];

  const provider = getAIProvider();
  const actions: AIActionView[] = [];
  let assistantText = "";

  for (let round = 0; round < AI_CONFIG.maxToolRounds; round += 1) {
    let result;
    try {
      result = await provider.chat({
        messages,
        tools: TOOL_DEFINITIONS,
        temperature: AI_CONFIG.temperature,
        maxTokens: AI_CONFIG.maxTokens,
        executeTool: async (name, args) =>
          executeTool({
            uid: input.uid,
            conversationId,
            name,
            arguments: JSON.stringify(args),
            snapshot,
          }),
      });
    } catch (error) {
      if (error instanceof CashioAIError) throw error;
      console.error("[cashio-ai] provider error", error);
      throw new CashioAIError("unavailable", USER_UNAVAILABLE_MESSAGE, 503);
    }

    if (result.toolsHandled) {
      assistantText = (result.content ?? "").trim();
      if (result.actions?.length) actions.push(...result.actions);
      break;
    }

    if (result.toolCalls.length) {
      messages.push({
        role: "assistant",
        content: result.content,
        tool_calls: result.toolCalls,
      });
      for (const call of result.toolCalls) {
        const executed = await executeTool({
          uid: input.uid,
          conversationId,
          name: call.name,
          arguments: call.arguments,
          snapshot,
        });
        if (executed.action) actions.push(executed.action);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: executed.content,
        });
      }
      continue;
    }

    assistantText = (result.content ?? "").trim();
    break;
  }

  if (!assistantText) {
    assistantText = actions.length
      ? "Review the details below and confirm if this looks right."
      : "I don't have enough information to calculate that.";
  }

  await addMessage(input.uid, conversationId, {
    role: "assistant",
    content: assistantText,
    actions: actions.length ? actions : undefined,
  });

  return {
    message: assistantText,
    conversationId,
    actions: actions.length ? actions : undefined,
  };
}
