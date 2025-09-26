import type { LLMProvider } from '@cursor-pilot/types';

/** OpenAI-backed provider stub; validates API key and shapes calls. */
export class OpenAIProvider implements LLMProvider {
  /** Perform a completion call via OpenAI (stub for now). */
  public async complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    return { text: 'y', tokensUsed: 1 };
  }
}
