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

  public constructor({ logDir, fileName }: MarkdownTranscriptOptions) {
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    this.filePath = join(logDir, fileName ?? 'session.md');
    this.stream = createWriteStream(this.filePath, { flags: 'a' });
    const header = '\n---\n';
    this.stream.write(header);
  }

  public heading(text: string): void {
    this.stream.write(`\n### ${text}\n\n`);
  }

  public note(text: string): void {
    this.stream.write(`- ${text}\n`);
  }

  public cursorHighlight(text: string): void {
    this.stream.write(`- **Cursor**: ${text}\n`);
  }

  public seedPrompt(content: string): void {
    this.stream.write('\n**Seeded Governing Prompt**\n\n');
    this.stream.write('```markdown\n');
    this.stream.write(content.trim());
    this.stream.write('\n```\n');
  }

  public llmExchange({
    system,
    user,
    response,
  }: { system: string; user: string; response: string }): void {
    this.stream.write('\n**LLM Exchange**\n');
    this.stream.write('- System:\n');
    this.fence(system);
    this.stream.write('- User:\n');
    this.fence(user);
    this.stream.write('- Response:\n');
    this.fence(response);
  }

  public typed(text: string): void {
    this.stream.write(`- **Typed**: ${text}\n`);
  }

  public close(): void {
    this.stream.end();
  }

  private fence(content: string): void {
    this.stream.write('```text\n');
    this.stream.write((content || '').trim());
    this.stream.write('\n```\n');
  }
}
