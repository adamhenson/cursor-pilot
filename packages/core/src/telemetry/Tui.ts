import blessed from 'blessed';

/** Minimal blessed-based TUI to show recent output and status. */
export class Tui {
  private screen: blessed.Widgets.Screen;
  private logBox: blessed.Widgets.Log;
  private statusBox: blessed.Widgets.BoxElement;

  public constructor() {
    this.screen = blessed.screen({ smartCSR: true, title: 'CursorPilot' });
    this.logBox = blessed.log({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '85%',
      tags: true,
      border: 'line',
      label: ' Output ',
      scrollable: true,
      mouse: true,
      keys: true,
      vi: true,
      alwaysScroll: true,
    });
    this.statusBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '15%',
      tags: true,
      border: 'line',
      label: ' Status ',
    });
    this.screen.key(['q', 'C-c'], () => this.destroy());
    this.screen.render();
  }

  public append(line: string): void {
    this.logBox.add(line);
    this.screen.render();
  }

  public setStatus(lines: string[]): void {
    this.statusBox.setContent(lines.join('\n'));
    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }
}
