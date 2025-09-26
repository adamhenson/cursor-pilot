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

  /** Construct a new CursorProcess wrapper. */
  public constructor(options: CursorProcessOptions) {
    this.options = options;
  }

  /** Start the PTY shell; does not automatically run a cursor command. */
  public async start(_: string[]): Promise<void> {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    this.ptyProc = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: this.options.cwd,
      env: process.env,
    });

    this.ptyProc.onData((data) => {
      process.stdout.write(data);
      for (const subscriber of this.dataSubscribers) subscriber(data);
    });
  }

  /** Execute a cursor command line within the PTY. */
  public async execCursor(args: string[]): Promise<void> {
    if (!this.ptyProc) return;
    const command = `${this.options.cursorBinary} ${args.join(' ')}`.trim();
    this.ptyProc.write(`${command}\r`);
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
      this.ptyProc = undefined;
      this.dataSubscribers = [];
    }
  }
}
