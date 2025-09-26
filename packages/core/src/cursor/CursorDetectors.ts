import { defaultDetectorPatterns } from "@cursor-pilot/detectors";

export type CursorEventType = "running" | "awaitingInput" | "question" | "completed";

export class CursorDetectors {
  private buffer: string = "";
  private lastEmitAt = 0;
  private readonly idleThresholdMs: number;

  public constructor({ idleThresholdMs = 800 }: { idleThresholdMs?: number } = {}) {
    this.idleThresholdMs = idleThresholdMs;
  }

  public ingestChunk(chunk: string): CursorEventType | null {
    this.buffer += chunk;
    const now = Date.now();
    const idle = now - this.lastEmitAt > this.idleThresholdMs;

    // Check completion first
    for (const re of defaultDetectorPatterns.completion) {
      if (re.test(this.buffer)) {
        this.lastEmitAt = now;
        return "completed";
      }
    }

    // Question or awaiting input when idle
    if (idle) {
      for (const re of defaultDetectorPatterns.question) {
        if (re.test(this.buffer)) {
          this.lastEmitAt = now;
          return "question";
        }
      }
      for (const re of defaultDetectorPatterns.awaitingInput) {
        if (re.test(this.buffer)) {
          this.lastEmitAt = now;
          return "awaitingInput";
        }
      }
    }

    return "running";
  }
}
