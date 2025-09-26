import { CursorProcess } from "../cursor/CursorProcess.js";
import { CursorDetectors } from "../cursor/CursorDetectors.js";
import type { OrchestratorEvent } from "./Events.js";

export type OrchestratorOptions = {
  cursorBinary?: string;
  cwd?: string;
};

export class Orchestrator {
  private readonly options: OrchestratorOptions;
  private process?: CursorProcess;
  private detectors: CursorDetectors | undefined;

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

    this.detectors = new CursorDetectors();

    this.process = new CursorProcess({
      cursorBinary: this.options.cursorBinary ?? "cursor",
      cwd: this.options.cwd ?? process.cwd(),
    });

    await this.process.start(argv);

    // Attach a lightweight output tap for classification
    this.process.onData((chunk) => {
      const eventType = this.detectors?.ingestChunk(chunk);
      if (!eventType) return;
      const event: OrchestratorEvent = { type: eventType } as OrchestratorEvent;
      // eslint-disable-next-line no-console
      console.log("[CursorPilot] event:", event.type);
    });
  }

  public async stop(): Promise<void> {
    await this.process?.dispose();
    this.process = undefined;
  }
}
