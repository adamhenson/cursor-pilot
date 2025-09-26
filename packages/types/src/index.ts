export interface LLMProvider {
  complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; tokensUsed: number }>;
}

export type Milliseconds = number;

export type JsonObject = Record<string, unknown>;
