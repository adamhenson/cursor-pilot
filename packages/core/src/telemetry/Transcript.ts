import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Options for configuring transcript logging. */
export type TranscriptOptions = {
  /** Directory to write transcript artifacts into */
  logDir: string;
  /** File name for the JSONL transcript (default: transcript.jsonl) */
  fileName?: string;
};

/** Single JSONL record written to the transcript. */
export type TranscriptRecord = {
  /** Milliseconds since epoch */
  ts: number;
  /** Event type label */
  type: string;
  /** Raw output chunk, if any */
  chunk?: string;
  /** Answer text, if any */
  answer?: string;
  /** Optional scope label for disambiguation (e.g., 'idle', 'qa') */
  scope?: string;
  /** Optional LLM system prompt */
  system?: string;
  /** Optional LLM user prompt */
  user?: string;
  /** Optional LLM response text */
  text?: string;
};

/** Lightweight JSONL transcript writer for session events and answers. */
export class Transcript {
  private readonly options: Required<TranscriptOptions>;
  private stream: ReturnType<typeof createWriteStream>;

  /** Create or append to a JSONL transcript in the provided directory. */
  public constructor(options: TranscriptOptions) {
    const resolved: Required<TranscriptOptions> = {
      fileName: options.fileName ?? 'transcript.jsonl',
      logDir: options.logDir,
    };
    this.options = resolved;
    if (!existsSync(resolved.logDir)) {
      mkdirSync(resolved.logDir, { recursive: true });
    }
    const filePath = join(resolved.logDir, resolved.fileName);
    this.stream = createWriteStream(filePath, { flags: 'a' });
  }

  /** Append a record to the transcript as a single JSON line. */
  public write(record: TranscriptRecord): void {
    const line = JSON.stringify(record);
    this.stream.write(`${line}\n`);
  }

  /** Close the underlying stream. */
  public close(): void {
    this.stream.end();
  }
}
