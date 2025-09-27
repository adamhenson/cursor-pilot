import { defaultDetectorPatterns } from '@cursor-pilot/detectors';

/** Event categories emitted by the output classifier. */
export type CursorEventType = 'running' | 'awaitingInput' | 'question' | 'completed' | 'idle';

export type DetectorPatterns = {
  question?: RegExp[];
  awaitingInput?: RegExp[];
  completion?: RegExp[];
};

function withMultiline(patterns: RegExp[]): RegExp[] {
  return patterns.map((re) => {
    const flags = re.flags.includes('m') ? re.flags : `${re.flags}m`;
    return new RegExp(re.source, flags);
  });
}

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
    const base = {
      question: patterns.question ?? defaultDetectorPatterns.question,
      awaitingInput: patterns.awaitingInput ?? defaultDetectorPatterns.awaitingInput,
      completion: patterns.completion ?? defaultDetectorPatterns.completion,
    };
    this.patterns = {
      question: withMultiline(base.question),
      awaitingInput: withMultiline(base.awaitingInput),
      completion: withMultiline(base.completion),
    };
  }

  /** Ingest a chunk of output and return the detected event type if any. */
  public ingestChunk(chunk: string): CursorEventType | null {
    this.buffer += chunk;
    const now = Date.now();
    const idle = now - this.lastEmitAt > this.idleThresholdMs;

    // Completion wins
    for (const re of this.patterns.completion) {
      if (re.test(this.buffer)) {
        this.lastEmitAt = now;
        return 'completed';
      }
    }

    // Prompt types should emit immediately when recognized
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

    // Fallback: emit idle if we've seen nothing new for a while
    if (idle) {
      this.lastEmitAt = now;
      return 'idle';
    }

    return 'running';
  }
}
