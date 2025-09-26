export type Interaction = { question: string; answer: string };

export class InteractionHistory {
  private readonly interactions: Interaction[] = [];
  private readonly capacity: number;

  public constructor({ capacity = 10 }: { capacity?: number } = {}) {
    this.capacity = capacity;
  }

  public add({ answer, question }: Interaction): void {
    this.interactions.push({ question, answer });
    if (this.interactions.length > this.capacity) {
      this.interactions.shift();
    }
  }

  public lastN(count: number): Interaction[] {
    if (count <= 0) return [];
    return this.interactions.slice(-count);
  }
}
