import type { LLMProvider } from '@cursor-pilot/types';

/** A trivial provider that returns canned answers for testing. */
export class MockProvider implements LLMProvider {
  /** Compute a terse reply based on simple heuristics. */
  public async complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string; tokensUsed: number }> {
    const u = input.user.toLowerCase();
    // Tiny heuristics for y/n and numeric menu
    if (/(\[y\/n\]|yes\/no|proceed|confirm)/.test(u)) {
      return { text: 'y', tokensUsed: 1 };
    }
    const numeric = u.match(/\((\d+)-(\d+)\)/);
    if (numeric) {
      return { text: '1', tokensUsed: 1 };
    }
    return { text: 'y', tokensUsed: 1 };
  }
}
