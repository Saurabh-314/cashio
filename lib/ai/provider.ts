import { getAIProvider as getConfiguredProvider } from "@/lib/ai/cursor";
import type { AIProvider } from "@/lib/ai/types";

export type { AIProvider } from "@/lib/ai/types";
export { CursorProvider, getAIProvider, setAIProviderForTests } from "@/lib/ai/cursor";

export function createAIProvider(): AIProvider {
  return getConfiguredProvider();
}
