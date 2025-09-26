import pty from "node-pty";

export type CursorProcessOptions = {
  cursorBinary: string;
  cwd: string;
};

export class CursorProcess {
  private readonly options: CursorProcessOptions;
  private ptyProc: pty.IPty | undefined;
  private dataSubscribers: Array<(chunk: string) => void> = [];

  public constructor(options: CursorProcessOptions) {
    this.options = options;
  }

  public async start(args: string[]): Promise<void> {
    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    this.ptyProc = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 120,
      rows: 30,
      cwd: this.options.cwd,
      env: process.env,
    });

    const command = `${this.options.cursorBinary} ${args.join(" ")}`.trim();
    this.ptyProc.write(`${command}\r`);

    this.ptyProc.onData((data) => {
      process.stdout.write(data);
      for (const subscriber of this.dataSubscribers) subscriber(data);
    });
  }

  public onData(handler: (chunk: string) => void): void {
    this.dataSubscribers.push(handler);
  }

  public async write(line: string): Promise<void> {
    if (!this.ptyProc) return;
    this.ptyProc.write(line.replace(/\n/g, "\r") + "\r");
  }

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
