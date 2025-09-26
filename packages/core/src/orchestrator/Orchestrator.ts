import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { buildContext } from '../context/ContextBuilder.js';
import { CursorDetectors } from '../cursor/CursorDetectors.js';
import { CursorProcess } from '../cursor/CursorProcess.js';
import { runShellCommand } from '../executors/ShellExecutor.js';
import { type ProviderName, createProvider } from '../llm/ProviderFactory.js';
import { loadPlan } from '../plan/PlanLoader.js';
import { baseSystemPrompt } from '../prompts/systemPrompt.js';
import { Transcript } from '../telemetry/Transcript.js';
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
  /** Optional directory to write transcript logs to */
  logDir?: string;
  /** Maximum wall-clock time for the run (ms) */
  timeoutMs?: number;
  /** Maximum number of answers to type */
  maxSteps?: number;
  /** Loop breaker: stop if same Q/A repeats this many times */
  loopBreaker?: number;
  /** Idle inference threshold */
  idleMs?: number;
  /** Whether to auto-type safe idle answers */
  autoAnswerIdle?: boolean;
  /** Whether to echo typed answers to stdout */
  echoAnswers?: boolean;
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
  private transcript: Transcript | undefined;
  private answersTyped = 0;
  private lastQAHash: string | undefined;
  private repeatedCount = 0;
  private stopTimer: NodeJS.Timeout | undefined;
  private consecutiveIdle = 0;

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
        cursor: this.options.cursorBinary ?? 'cursor-agent',
        cwd,
        args: argv,
        provider: this.options.provider ?? 'mock',
        model: this.options.model,
        temperature: this.options.temperature,
        plan: plan ? { name: plan.name, steps: plan.steps.map((s) => s.name) } : undefined,
        timeoutMs: this.options.timeoutMs,
        maxSteps: this.options.maxSteps,
        loopBreaker: this.options.loopBreaker,
        idleMs: this.options.idleMs,
        autoAnswerIdle: this.options.autoAnswerIdle,
      });
      return;
    }

    const provider = createProvider(this.options.provider ?? 'mock');
    this.detectors = new CursorDetectors({ idleThresholdMs: this.options.idleMs ?? 5000 });
    this.transcript = this.options.logDir
      ? new Transcript({ logDir: this.options.logDir })
      : undefined;

    // Preflight: ensure cursor binary exists on PATH
    const cursorBinary = this.options.cursorBinary ?? 'cursor';
    const which = await runShellCommand({ cmd: `command -v ${cursorBinary}`, cwd });
    if (which.exitCode !== 0) {
      const msg = `Cursor binary not found on PATH: ${cursorBinary}. Install it or pass --cursor.`;
      // eslint-disable-next-line no-console
      console.error(`[CursorPilot] ${msg}`);
      this.transcript?.write({ ts: Date.now(), type: 'cursor-not-found', chunk: msg });
      return;
    }

    if (this.options.timeoutMs && this.options.timeoutMs > 0) {
      this.stopTimer = setTimeout(async () => {
        this.transcript?.write({ ts: Date.now(), type: 'timeout' });
        await this.stop();
      }, this.options.timeoutMs);
    }

    this.process = new CursorProcess({
      cursorBinary,
      cwd,
    });

    await this.process.start([]);

    const system = baseSystemPrompt();
    const governing = await resolveGoverningPrompt(this.options.governingPrompt, cwd);

    this.process.onData(async (chunk) => {
      this.transcript?.write({ ts: Date.now(), type: 'stdout', chunk });

      const eventType = this.detectors?.ingestChunk(chunk);
      if (!eventType) return;
      const event: OrchestratorEvent = { type: eventType } as OrchestratorEvent;
      // eslint-disable-next-line no-console
      console.log('[CursorPilot] event:', event.type);
      this.transcript?.write({ ts: Date.now(), type: event.type });

      if (event.type === 'idle') {
        this.consecutiveIdle += 1;
        if (this.consecutiveIdle >= 2) {
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
          this.transcript?.write({ ts: Date.now(), type: 'idle-suggestion', answer: text });
          // Only auto-answer trivial cases when explicitly enabled
          if (this.options.autoAnswerIdle && (/^(y|n)$/i.test(text) || /^\d+$/.test(text))) {
            await this.process?.write(text);
          }
        }
        return;
      }
      this.consecutiveIdle = 0;

      if (event.type === 'question' || event.type === 'awaitingInput') {
        if (this.options.maxSteps && this.answersTyped >= this.options.maxSteps) {
          this.transcript?.write({ ts: Date.now(), type: 'max-steps-reached' });
          await this.stop();
          return;
        }

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

        const qaHash = `${event.type}|${text}`;
        if (this.lastQAHash === qaHash) {
          this.repeatedCount += 1;
          if (this.options.loopBreaker && this.repeatedCount >= this.options.loopBreaker) {
            this.transcript?.write({ ts: Date.now(), type: 'loop-breaker', answer: text });
            await this.stop();
            return;
          }
        } else {
          this.lastQAHash = qaHash;
          this.repeatedCount = 0;
        }

        this.transcript?.write({ ts: Date.now(), type: 'answer', answer: text });
        // eslint-disable-next-line no-console
        console.log('[CursorPilot] answer:', text);
        if (this.options.echoAnswers) {
          // eslint-disable-next-line no-console
          console.log(`[CursorPilot] typed: ${text}`);
        }
        await this.process?.write(text);
        this.answersTyped += 1;
      }
    });

    // Execute plan steps sequentially (basic version)
    if (plan?.steps?.length) {
      for (const step of plan.steps) {
        if (step.run?.length) {
          for (const cmd of step.run) {
            const { exitCode, stdout, stderr } = await runShellCommand({ cmd, cwd });
            this.transcript?.write({
              ts: Date.now(),
              type: 'run',
              chunk: `$ ${cmd}\n${stdout}${stderr}`,
            });
            if (exitCode !== 0) {
              this.transcript?.write({ ts: Date.now(), type: 'run-error', chunk: cmd });
              await this.stop();
              return;
            }
          }
        }
        if (step.cursor?.length) {
          for (const cargs of step.cursor) {
            const parts = cargs.split(' ').filter(Boolean);
            await this.process.execCursor(parts);
            // Best-effort wait loop: expect either 'completed' or a prompt sequence will follow
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
    }
  }

  /** Stop the run session and clean up the PTY process. */
  public async stop(): Promise<void> {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    await this.process?.dispose();
    this.transcript?.close();
    this.process = undefined;
  }
}
