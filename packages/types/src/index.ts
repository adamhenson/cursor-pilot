/** Minimal interface for a large language model provider. */
export interface LLMProvider {
  /** Create a short completion to drive terminal input. */
  complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; tokensUsed: number }>;
}

/** Milliseconds represented as a number. */
export type Milliseconds = number;

/** JSON object with string keys and unknown values. */
export type JsonObject = Record<string, unknown>;
