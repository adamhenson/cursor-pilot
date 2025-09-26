import type { LLMProvider } from "@cursor-pilot/types";
import { OpenAIProvider } from "./OpenAIProvider.js";
import { MockProvider } from "./MockProvider.js";

export type ProviderName = "openai" | "mock";

export function createProvider(name: ProviderName): LLMProvider {
  switch (name) {
    case "openai":
      return new OpenAIProvider();
    case "mock":
      return new MockProvider();
    default:
      return new MockProvider();
  }
}
