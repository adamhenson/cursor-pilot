/** Lightweight ring buffer for recent question/answer interactions. */
export type Interaction = { question: string; answer: string };

/** Store and retrieve a bounded list of recent interactions. */
export class InteractionHistory {
  private readonly interactions: Interaction[] = [];
  private readonly capacity: number;

  /** Create a new history with an optional capacity (default 10). */
  public constructor({ capacity = 10 }: { capacity?: number } = {}) {
    this.capacity = capacity;
  }

  /** Append an interaction and evict the oldest if over capacity. */
  public add({ answer, question }: Interaction): void {
    this.interactions.push({ question, answer });
    if (this.interactions.length > this.capacity) {
      this.interactions.shift();
    }
  }

  /** Retrieve the last N interactions (up to capacity). */
  public lastN(count: number): Interaction[] {
    if (count <= 0) return [];
    return this.interactions.slice(-count);
  }
}
