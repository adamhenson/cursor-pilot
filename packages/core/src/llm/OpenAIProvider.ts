import type { LLMProvider } from "@cursor-pilot/types";

export class OpenAIProvider implements LLMProvider {
  public async complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    // Placeholder: Wire actual OpenAI SDK here later
    return { text: "y", tokensUsed: 1 };
  }
}
