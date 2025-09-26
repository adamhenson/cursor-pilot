import { CursorProcess } from "../cursor/CursorProcess.js";
import { CursorDetectors } from "../cursor/CursorDetectors.js";
import type { OrchestratorEvent } from "./Events.js";
import { createProvider, type ProviderName } from "../llm/ProviderFactory.js";

export type OrchestratorOptions = {
  cursorBinary?: string;
  cwd?: string;
  provider?: ProviderName;
  model?: string;
  temperature?: number;
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
        provider: this.options.provider ?? "mock",
        model: this.options.model,
        temperature: this.options.temperature,
      });
      return;
    }

    const provider = createProvider(this.options.provider ?? "mock");
    this.detectors = new CursorDetectors();

    this.process = new CursorProcess({
      cursorBinary: this.options.cursorBinary ?? "cursor",
      cwd: this.options.cwd ?? process.cwd(),
    });

    await this.process.start(argv);

    this.process.onData(async (chunk) => {
      const eventType = this.detectors?.ingestChunk(chunk);
      if (!eventType) return;
      const event: OrchestratorEvent = { type: eventType } as OrchestratorEvent;
      // eslint-disable-next-line no-console
      console.log("[CursorPilot] event:", event.type);

      if (event.type === "question" || event.type === "awaitingInput") {
        const { text } = await provider.complete({
          system: "You are a terminal replier.",
          user: chunk,
          maxTokens: 5,
          temperature: this.options.temperature ?? 0,
        });
        // eslint-disable-next-line no-console
        console.log("[CursorPilot] answer:", text);
        await this.process?.write(text);
      }
    });
  }

  public async stop(): Promise<void> {
    await this.process?.dispose();
    this.process = undefined;
  }
}
