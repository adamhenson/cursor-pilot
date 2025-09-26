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
    const isGpt5 = this.model.toLowerCase().startsWith('gpt-5');

    // Helper to call Responses API (used for gpt-5 or as fallback)
    const callResponses = async () => {
      const resp = await this.client.responses.create({
        model: this.model,
        // Use defaults for gpt-5 (no explicit token limit); concatenate prompts
        input: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        temperature: input.temperature ?? 0,
      } as any);
      const text = (resp as any).output_text ?? '';
      const usage: any = (resp as any).usage ?? {};
      const tokensUsed = usage.total_tokens ?? usage.output_tokens ?? 0;
      return { text, tokensUsed };
    };

    // Prefer Responses API for gpt-5
    if (isGpt5) {
      return await callResponses();
    }

    // Otherwise try Chat Completions; if the model rejects max_tokens, fallback to Responses
    try {
      const resp = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        // Let the API use model defaults by not forcing max_tokens
        temperature: input.temperature ?? 0,
      });
      const text = resp.choices?.[0]?.message?.content ?? '';
      const tokensUsed = resp.usage ? (resp.usage.total_tokens ?? 0) : 0;
      return { text, tokensUsed };
    } catch (err: any) {
      // If param error (e.g., max_tokens unsupported), fallback to Responses API
      if (err?.code === 'unsupported_parameter' || /max_tokens/i.test(String(err?.message))) {
        return await callResponses();
      }
      throw err;
    }
  }
}
