import type { LLMProvider } from '@cursor-pilot/types';
import OpenAI from 'openai';

/** OpenAI-backed provider. */
export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  public constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.CURSORPILOT_MODEL || 'gpt-4o-mini';
  }

  public async complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; tokensUsed: number }> {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
      max_tokens: input.maxTokens ?? 32,
      temperature: input.temperature ?? 0,
    });

    const text = resp.choices?.[0]?.message?.content ?? '';
    const tokensUsed = resp.usage ? (resp.usage.total_tokens ?? 0) : 0;
    return { text, tokensUsed };
  }
}
