import { Agent, CursorAgentError, type SDKCustomTool } from "@cursor/sdk";
import { resolveProviderConfig } from "@/lib/ai/config";
import { CashioAIError, USER_UNAVAILABLE_MESSAGE } from "@/lib/ai/errors";
import type {
  AIActionView,
  AIChatRequestPayload,
  AIChatResult,
  AIProvider,
  AIProviderMessage,
  AIToolDefinition,
} from "@/lib/ai/types";

function promptFromMessages(messages: AIProviderMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      lines.push(message.content);
      continue;
    }
    if (message.role === "user") {
      lines.push(`User:\n${message.content}`);
      continue;
    }
    if (message.role === "assistant" && message.content) {
      lines.push(`Assistant:\n${message.content}`);
    }
  }
  return lines.join("\n\n");
}

function toCustomTools(
  tools: AIToolDefinition[] | undefined,
  executeTool: NonNullable<AIChatRequestPayload["executeTool"]>,
  actions: AIActionView[],
): Record<string, SDKCustomTool> {
  const defined: Record<string, SDKCustomTool> = {};
  for (const tool of tools ?? []) {
    defined[tool.name] = {
      description: tool.description,
      inputSchema: tool.parameters as unknown as SDKCustomTool["inputSchema"],
      async execute(args) {
        const result = await executeTool(tool.name, (args ?? {}) as Record<string, unknown>);
        if (result.action) actions.push(result.action);
        return result.content;
      },
    };
  }
  return defined;
}

export class CursorProvider implements AIProvider {
  async chat(request: AIChatRequestPayload): Promise<AIChatResult> {
    const config = resolveProviderConfig();
    if (!config) {
      throw new CashioAIError("unavailable", USER_UNAVAILABLE_MESSAGE, 503);
    }
    if (!request.executeTool) {
      throw new CashioAIError("unavailable", USER_UNAVAILABLE_MESSAGE, 503);
    }

    const actions: AIActionView[] = [];
    const customTools = toCustomTools(request.tools, request.executeTool, actions);

    try {
      const result = await Agent.prompt(promptFromMessages(request.messages), {
        apiKey: config.apiKey,
        model: { id: config.model },
        tools: ["mcp"],
        disallowedTools: ["shell", "task"],
        local: {
          cwd: process.cwd(),
          settingSources: [],
          customTools,
        },
      });

      if (result.status === "error") {
        console.error("[cashio-ai] cursor run failed", result.id, result.error?.message);
        throw new CashioAIError("unavailable", USER_UNAVAILABLE_MESSAGE, 503);
      }

      return {
        content: result.result?.trim() || null,
        toolCalls: [],
        actions: actions.length ? actions : undefined,
        toolsHandled: true,
      };
    } catch (error) {
      if (error instanceof CashioAIError) throw error;
      if (error instanceof CursorAgentError) {
        console.error("[cashio-ai] cursor startup failed", error.message, "retryable=", error.isRetryable);
      } else {
        console.error("[cashio-ai] cursor provider error", error);
      }
      throw new CashioAIError("unavailable", USER_UNAVAILABLE_MESSAGE, 503);
    }
  }
}

let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!resolveProviderConfig()) {
    throw new CashioAIError("unavailable", USER_UNAVAILABLE_MESSAGE, 503);
  }
  if (!provider) provider = new CursorProvider();
  return provider;
}

export function setAIProviderForTests(next: AIProvider | null) {
  provider = next;
}
