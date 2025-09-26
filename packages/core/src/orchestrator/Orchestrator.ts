import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { buildContext } from '../context/ContextBuilder.js';
import { CursorDetectors } from '../cursor/CursorDetectors.js';
import { CursorProcess } from '../cursor/CursorProcess.js';
import { type ProviderName, createProvider } from '../llm/ProviderFactory.js';
import { loadPlan } from '../plan/PlanLoader.js';
import { baseSystemPrompt } from '../prompts/systemPrompt.js';
import type { OrchestratorEvent } from './Events.js';

/** Options that configure the orchestrator runtime behavior. */
export type OrchestratorOptions = {
  /** Binary name/path for Cursor */
  cursorBinary?: string;
  /** Working directory to run commands */
  cwd?: string;
  /** LLM provider to use */
  provider?: ProviderName;
  /** Model identifier for the provider */
  model?: string;
  /** Sampling temperature */
  temperature?: number;
  /** Governing prompt (file path or literal text) */
  governingPrompt?: string;
  /** Optional path to a plan.yml */
  planPath?: string;
};

async function resolveGoverningPrompt(
  value: string | undefined,
  cwd: string
): Promise<string | undefined> {
  if (!value) return undefined;
  try {
    const fullPath = value.startsWith('/') ? value : `${cwd}/${value}`;
    await access(fullPath, fsConstants.F_OK);
    const content = await readFile(fullPath, 'utf8');
    return content;
  } catch {
    return value;
  }
}

/**
 * High-level coordinator that spawns Cursor under a PTY, classifies output,
 * builds prompts, calls the provider, and types answers back.
 */
export class Orchestrator {
  private readonly options: OrchestratorOptions;
  private process?: CursorProcess;
  private detectors: CursorDetectors | undefined;

  /** Construct a new orchestrator with the provided options. */
  public constructor(options: OrchestratorOptions = {}) {
    this.options = options;
  }

  /** Start a run session, optionally in dry-run mode. */
  public async start({
    args,
    dryRun,
  }: {
    args?: string[];
    dryRun?: boolean;
  }): Promise<void> {
    const cwd = this.options.cwd ?? process.cwd();

    const plan = this.options.planPath
      ? await loadPlan(
          this.options.planPath.startsWith('/')
            ? this.options.planPath
            : `${cwd}/${this.options.planPath}`
        )
      : undefined;

    const planCursorArgs = plan?.steps?.[0]?.cursor ?? [];
    const argv = (args && args.length > 0 ? args : planCursorArgs) ?? [];

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log('[CursorPilot] Dry run: would start Cursor with:', {
        cursor: this.options.cursorBinary ?? 'cursor',
        cwd,
        args: argv,
        provider: this.options.provider ?? 'mock',
        model: this.options.model,
        temperature: this.options.temperature,
        plan: plan ? { name: plan.name, steps: plan.steps.map((s) => s.name) } : undefined,
      });
      return;
    }

    const provider = createProvider(this.options.provider ?? 'mock');
    this.detectors = new CursorDetectors();

    this.process = new CursorProcess({
      cursorBinary: this.options.cursorBinary ?? 'cursor',
      cwd,
    });

    await this.process.start(argv);

    const system = baseSystemPrompt();
    const governing = await resolveGoverningPrompt(this.options.governingPrompt, cwd);

    this.process.onData(async (chunk) => {
      const eventType = this.detectors?.ingestChunk(chunk);
      if (!eventType) return;
      const event: OrchestratorEvent = { type: eventType } as OrchestratorEvent;
      // eslint-disable-next-line no-console
      console.log('[CursorPilot] event:', event.type);

      if (event.type === 'question' || event.type === 'awaitingInput') {
        const { userPrompt } = await buildContext({
          governingPrompt: governing,
          recentOutput: chunk,
          cwd,
        });
        const { text } = await provider.complete({
          system,
          user: userPrompt,
          maxTokens: 16,
          temperature: this.options.temperature ?? 0,
        });
        // eslint-disable-next-line no-console
        console.log('[CursorPilot] answer:', text);
        await this.process?.write(text);
      }
    });
  }

  /** Stop the run session and clean up the PTY process. */
  public async stop(): Promise<void> {
    await this.process?.dispose();
    this.process = undefined;
  }
}
