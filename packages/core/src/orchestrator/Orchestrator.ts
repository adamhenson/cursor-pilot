import { CursorProcess } from "../cursor/CursorProcess.js";

export type OrchestratorOptions = {
  cursorBinary?: string;
  cwd?: string;
};

export class Orchestrator {
  private readonly options: OrchestratorOptions;
  private process?: CursorProcess;

  public constructor(options: OrchestratorOptions = {}) {
    this.options = options;
  }

  public async start({
    args,
    dryRun,
  }: {
    args?: string[];
    dryRun?: boolean;
  }): Promise<void> {
    const argv = args ?? [];

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log("[CursorPilot] Dry run: would start Cursor with:", {
        cursor: this.options.cursorBinary ?? "cursor",
        cwd: this.options.cwd ?? process.cwd(),
        args: argv,
      });
      return;
    }

    this.process = new CursorProcess({
      cursorBinary: this.options.cursorBinary ?? "cursor",
      cwd: this.options.cwd ?? process.cwd(),
    });
    await this.process.start(argv);
  }

  public async stop(): Promise<void> {
    await this.process?.dispose();
    this.process = undefined;
  }
}
