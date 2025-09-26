import { defaultDetectorPatterns } from '@cursor-pilot/detectors';

/** Event categories emitted by the output classifier. */
export type CursorEventType = 'running' | 'awaitingInput' | 'question' | 'completed' | 'idle';

export type DetectorPatterns = {
  question?: RegExp[];
  awaitingInput?: RegExp[];
  completion?: RegExp[];
};

/**
 * Streaming classifier using regex patterns with a simple idle debounce.
 * Accumulates output and emits coarse-grained events for the orchestrator.
 */
export class CursorDetectors {
  private buffer = '';
  private lastEmitAt = 0;
  private readonly idleThresholdMs: number;
  private readonly patterns: Required<DetectorPatterns>;

  /** Create a new detectors instance with an optional idle threshold and pattern overrides. */
  public constructor({
    idleThresholdMs = 800,
    patterns = {} as DetectorPatterns,
  }: { idleThresholdMs?: number; patterns?: DetectorPatterns } = {}) {
    this.idleThresholdMs = idleThresholdMs;
    this.patterns = {
      question: patterns.question ?? defaultDetectorPatterns.question,
      awaitingInput: patterns.awaitingInput ?? defaultDetectorPatterns.awaitingInput,
      completion: patterns.completion ?? defaultDetectorPatterns.completion,
    };
  }

  /** Ingest a chunk of output and return the detected event type if any. */
  public ingestChunk(chunk: string): CursorEventType | null {
    this.buffer += chunk;
    const now = Date.now();
    const idle = now - this.lastEmitAt > this.idleThresholdMs;

    for (const re of this.patterns.completion) {
      if (re.test(this.buffer)) {
        this.lastEmitAt = now;
        return 'completed';
      }
    }

    if (idle) {
      for (const re of this.patterns.question) {
        if (re.test(this.buffer)) {
          this.lastEmitAt = now;
          return 'question';
        }
      }
      for (const re of this.patterns.awaitingInput) {
        if (re.test(this.buffer)) {
          this.lastEmitAt = now;
          return 'awaitingInput';
        }
      }
      this.lastEmitAt = now;
      return 'idle';
    }

    return 'running';
  }
}
