const DEFAULT_MODEL = "composer-2.5";

export const AI_CONFIG = {
  timezone: "Asia/Kolkata",
  maxHistoryMessages: 10,
  maxToolRounds: 6,
  maxTokens: 1200,
  temperature: 0.2,
  rateLimit: {
    maxRequests: 30,
    windowMs: 15 * 60 * 1000,
  },
  cursor: {
    defaultModel: DEFAULT_MODEL,
  },
} as const;

export interface ProviderConfig {
  driver: "cursor";
  apiKey: string;
  model: string;
}

function firstEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function getCursorApiKey(): string | null {
  return firstEnv("CURSOR_API_KEY");
}

export function isAIConfigured(): boolean {
  return Boolean(getCursorApiKey());
}

export function resolveProviderConfig(): ProviderConfig | null {
  const apiKey = getCursorApiKey();
  if (!apiKey) return null;
  return {
    driver: "cursor",
    apiKey,
    model: firstEnv("CURSOR_AI_MODEL") ?? AI_CONFIG.cursor.defaultModel,
  };
}
