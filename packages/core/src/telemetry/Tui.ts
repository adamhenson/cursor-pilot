import blessed from 'blessed';

/** Minimal blessed-based TUI to show recent output and status with CR-aware rendering. */
export class Tui {
  private screen: blessed.Widgets.Screen;
  private logBox: blessed.Widgets.BoxElement;
  private statusBox: blessed.Widgets.BoxElement;
  private lines: string[] = [];
  private currentLine = '';
  private maxLines = 400; // on-screen history
  private renderScheduled = false;

  public constructor() {
    this.screen = blessed.screen({ smartCSR: true, title: 'CursorPilot' });
    this.logBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '85%',
      tags: false,
      border: 'line',
      label: ' Output ',
      scrollable: false,
    });
    this.statusBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '15%',
      tags: false,
      border: 'line',
      label: ' Status ',
    });
    this.screen.key(['q', 'C-c'], () => this.destroy());
    this.screen.render();
  }

  // Append a raw chunk; handle CR (\r) to rewrite current line instead of appending
  public append(chunk: string): void {
    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i];
      if (ch === '\r') {
        // Reset current line for rewrite
        this.currentLine = '';
        continue;
      }
      if (ch === '\n') {
        this.flushLine();
        continue;
      }
      // Ignore other control characters
      const code = ch.charCodeAt(0);
      if (code < 32 && code !== 9) continue;
      this.currentLine += ch;
    }
    this.scheduleRender();
  }

  public setStatus(lines: string[]): void {
    this.statusBox.setContent(lines.join('\n'));
    this.scheduleRender();
  }

  public destroy(): void {
    this.screen.destroy();
  }

  private flushLine(): void {
    if (this.currentLine.length > 0 || this.lines.length === 0) {
      this.lines.push(this.currentLine);
      if (this.lines.length > this.maxLines) this.lines.shift();
    }
    this.currentLine = '';
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    setTimeout(() => {
      this.renderScheduled = false;
      const content = [...this.lines, this.currentLine].join('\n');
      this.logBox.setContent(content);
      this.screen.render();
    }, 50);
  }
}
