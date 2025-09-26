import type { LLMProvider } from '@cursor-pilot/types';
import { MockProvider } from './MockProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';

/** Supported provider names. */
export type ProviderName = 'openai' | 'mock';

/** Create an LLM provider instance from a provider name. */
export function createProvider(name: ProviderName): LLMProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'mock':
      return new MockProvider();
    default:
      return new MockProvider();
  }
}
