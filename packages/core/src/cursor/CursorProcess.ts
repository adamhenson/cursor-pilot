import pty from 'node-pty';

/** Options to configure the spawned Cursor PTY process. */
export type CursorProcessOptions = {
  /** Name or path of the Cursor binary to run */
  cursorBinary: string;
  /** Working directory for the PTY */
  cwd: string;
};

/** Lightweight wrapper around node-pty to run Cursor interactively. */
export class CursorProcess {
  private readonly options: CursorProcessOptions;
  private ptyProc: pty.IPty | undefined;
  private dataSubscribers: Array<(chunk: string) => void> = [];
  private removeResizeListener: (() => void) | undefined;

  /** Construct a new CursorProcess wrapper. */
  public constructor(options: CursorProcessOptions) {
    this.options = options;
  }

  /** Start the PTY shell; does not automatically run a cursor command. */
  public async start(_: string[]): Promise<void> {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const cols = (process.stdout as any)?.columns ?? 120;
    const rows = (process.stdout as any)?.rows ?? 30;
    this.ptyProc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: this.options.cwd,
      env: process.env,
    });

    this.ptyProc.onData((data) => {
      for (const subscriber of this.dataSubscribers) subscriber(data);
    });

    // Sync PTY size with host TTY
    const resizeHandler = () => {
      try {
        const ncols = (process.stdout as any)?.columns ?? cols;
        const nrows = (process.stdout as any)?.rows ?? rows;
        this.ptyProc?.resize(ncols, nrows);
      } catch {
        // ignore
      }
    };
    (process.stdout as any)?.on?.('resize', resizeHandler);
    this.removeResizeListener = () => {
      (process.stdout as any)?.off?.('resize', resizeHandler);
    };
  }

  /** Execute a cursor command line within the PTY. */
  public async execCursor(args: string[]): Promise<void> {
    if (!this.ptyProc) return;
    const command = `${this.options.cursorBinary} ${args.join(' ')}`.trim();
    const marker = '__CURSORPILOT_DONE__';
    // Single-quote for sh -lc; escape any single quotes in the command
    const sq = (s: string) => `'${s.replace(/'/g, `'\''`)}'`;
    const wrapped = `sh -lc ${sq(`${command}; printf ${marker}\\n`)}`;
    this.ptyProc.write(`${wrapped}\r`);
  }

  /** Subscribe to raw PTY output data chunks. */
  public onData(handler: (chunk: string) => void): void {
    this.dataSubscribers.push(handler);
  }

  /** Type a line into the PTY, normalizing newlines to carriage return. */
  public async write(line: string): Promise<void> {
    if (!this.ptyProc) return;
    this.ptyProc.write(`${line.replace(/\n/g, '\r')}\r`);
  }

  /** Dispose of the PTY process and clear subscribers. */
  public async dispose(): Promise<void> {
    if (!this.ptyProc) return;
    try {
      this.ptyProc.kill();
    } finally {
      if (this.removeResizeListener) {
        this.removeResizeListener();
        this.removeResizeListener = undefined;
      }
      this.ptyProc = undefined;
      this.dataSubscribers = [];
    }
  }
}
