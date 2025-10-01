import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Options for configuring markdown transcript logging. */
export type MarkdownTranscriptOptions = {
  /** Directory to write transcript artifacts into */
  logDir: string;
  /** File name for the markdown transcript (default: session.md) */
  fileName?: string;
};

/** Lightweight Markdown transcript that reads like a chat log. */
export class MarkdownTranscript {
  private readonly filePath: string;
  private stream: ReturnType<typeof createWriteStream>;
  private closed = false;

  public constructor({ logDir, fileName }: MarkdownTranscriptOptions) {
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    this.filePath = join(logDir, fileName ?? 'session.md');
    this.stream = createWriteStream(this.filePath, { flags: 'a' });
    const header = '\n---\n';
    this.safeWrite(header);
  }

  public heading(text: string): void {
    this.safeWrite(`\n### ${text}\n\n`);
  }

  public note(text: string): void {
    this.safeWrite(`- ${text}\n`);
  }

  public cursorHighlight(text: string): void {
    this.safeWrite(`- **Cursor**: ${text}\n`);
  }

  public seedPrompt(content: string): void {
    this.safeWrite('\n**Seeded Governing Prompt**\n\n');
    this.safeWrite('```markdown\n');
    this.safeWrite(content.trim());
    this.safeWrite('\n```\n');
  }

  public llmExchange({
    system,
    user,
    response,
  }: { system: string; user: string; response: string }): void {
    this.safeWrite('\n**LLM Exchange**\n');
    this.safeWrite('- System:\n');
    this.fence(system);
    this.safeWrite('- User:\n');
    this.fence(user);
    this.safeWrite('- Response:\n');
    this.fence(response);
  }

  public typed(text: string): void {
    this.safeWrite(`- **Typed**: ${text}\n`);
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.stream.end();
    } catch {
      // ignore
    }
  }

  private fence(content: string): void {
    this.safeWrite('```text\n');
    this.safeWrite((content || '').trim());
    this.safeWrite('\n```\n');
  }

  private safeWrite(chunk: string): void {
    if (this.closed) return;
    const s: any = this.stream as any;
    if (!this.stream || this.stream.destroyed || s.writableEnded === true) return;
    try {
      this.stream.write(chunk);
    } catch {
      // ignore late writes after close
    }
  }
}
