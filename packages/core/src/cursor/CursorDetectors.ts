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
  private lastMeaningfulAt = 0;
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
    // Detect meaningful (non-ANSI, non-whitespace) characters to gate idle
    const ansiStripped = stripAnsiSequences(chunk);
    if (containsMeaningfulText(ansiStripped)) {
      this.lastMeaningfulAt = now;
    }
    const refTs = this.lastMeaningfulAt || this.lastEmitAt;
    const idle = now - refTs > this.idleThresholdMs;

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

/** Remove common ANSI CSI/OSC sequences without using control-char regex literals. */
function stripAnsiSequences(input: string): string {
  let result = '';
  let i = 0;
  const n = input.length;
  while (i < n) {
    const code = input.charCodeAt(i);
    if (code === 0x1b /* ESC */ && i + 1 < n) {
      const next = input.charAt(i + 1);
      if (next === '[') {
        // CSI: ESC [ ... letter
        i += 2;
        while (i < n) {
          const ch = input.charAt(i);
          if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }
      if (next === ']') {
        // OSC: ESC ] ... BEL (0x07)
        i += 2;
        while (i < n && input.charCodeAt(i) !== 0x07) i += 1;
        if (i < n) i += 1; // consume BEL
        continue;
      }
    }
    result += input.charAt(i);
    i += 1;
  }
  return result;
}

function containsMeaningfulText(input: string): boolean {
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    // Skip whitespace and C0 controls (<= 0x20) and DEL (0x7F)
    if (
      code <= 0x20 ||
      code === 0x7f ||
      code === 0x00 ||
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      code === 0x20
    ) {
      continue;
    }
    return true;
  }
  return false;
}
