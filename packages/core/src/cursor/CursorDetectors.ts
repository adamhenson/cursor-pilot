import { defaultDetectorPatterns } from '@cursor-pilot/detectors';

/** Event categories emitted by the output classifier. */
export type CursorEventType = 'running' | 'awaitingInput' | 'question' | 'completed';

/**
 * Streaming classifier using regex patterns with a simple idle debounce.
 * Accumulates output and emits coarse-grained events for the orchestrator.
 */
export class CursorDetectors {
  private buffer = '';
  private lastEmitAt = 0;
  private readonly idleThresholdMs: number;

  /** Create a new detectors instance with an optional idle threshold. */
  public constructor({ idleThresholdMs = 800 }: { idleThresholdMs?: number } = {}) {
    this.idleThresholdMs = idleThresholdMs;
  }

  /** Ingest a chunk of output and return the detected event type if any. */
  public ingestChunk(chunk: string): CursorEventType | null {
    this.buffer += chunk;
    const now = Date.now();
    const idle = now - this.lastEmitAt > this.idleThresholdMs;

    for (const re of defaultDetectorPatterns.completion) {
      if (re.test(this.buffer)) {
        this.lastEmitAt = now;
        return 'completed';
      }
    }

    if (idle) {
      for (const re of defaultDetectorPatterns.question) {
        if (re.test(this.buffer)) {
          this.lastEmitAt = now;
          return 'question';
        }
      }
      for (const re of defaultDetectorPatterns.awaitingInput) {
        if (re.test(this.buffer)) {
          this.lastEmitAt = now;
          return 'awaitingInput';
        }
      }
    }

    return 'running';
  }
}
