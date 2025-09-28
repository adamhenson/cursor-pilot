import { createRequire } from 'node:module';
import blessed from 'blessed';

/** Minimal blessed-based TUI to show recent output and status with CR-aware rendering. */
export class Tui {
  private screen: blessed.Widgets.Screen;
  private logBox: blessed.Widgets.BoxElement;
  private statusBox: blessed.Widgets.BoxElement;
  private term: any;
  private renderScheduled = false;
  private frameBuffer = '';

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
    // Load @xterm/headless via CJS require for ESM compatibility
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XHeadless = require('@xterm/headless');
    const TerminalCtor = XHeadless.Terminal || XHeadless.default?.Terminal || XHeadless;
    this.term = new TerminalCtor({ cols: 120, rows: 40, allowProposedApi: true });
    this.term.onData((data: string) => {
      // Headless terminal emits input; ignore for now
    });
  }

  public append(chunk: string): void {
    // Write raw chunk directly to headless xterm, which interprets cursor movement/erase
    this.term.write(chunk);
    // Prepare frame text for blessed by reading terminal buffer lines
    this.frameBuffer = this.getFrame();
    this.scheduleRender();
  }

  public setStatus(lines: string[]): void {
    this.statusBox.setContent(lines.join('\n'));
    this.scheduleRender();
  }

  public destroy(): void {
    this.screen.destroy();
  }

  private getFrame(): string {
    const lines: string[] = [];
    const buffer = this.term.buffer.active;
    const rows = buffer.length;
    for (let y = 0; y < rows; y += 1) {
      const line = buffer.getLine(y);
      if (!line) {
        lines.push('');
        continue;
      }
      lines.push(line.translateToString());
    }
    return lines.join('\n');
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    setTimeout(() => {
      this.renderScheduled = false;
      this.logBox.setContent(this.frameBuffer);
      this.screen.render();
    }, 50);
  }
}
