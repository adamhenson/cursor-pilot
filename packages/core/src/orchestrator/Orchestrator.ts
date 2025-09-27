import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { buildContext } from '../context/ContextBuilder.js';
import { CursorDetectors } from '../cursor/CursorDetectors.js';
import type { DetectorPatterns } from '../cursor/CursorDetectors.js';
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
  /** Maximum wall-clock time for a single cursor command (ms) */
  cursorCmdTimeoutMs?: number;
  /** Optional path to detectors JSON overrides */
  detectorsPath?: string;
  /** Whether to print verbose events to console */
  verboseEvents?: boolean;
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
  private readonly verboseEvents: boolean;

  /** Construct a new orchestrator with the provided options. */
  public constructor(options: OrchestratorOptions = {}) {
    this.options = options;
    this.verboseEvents = Boolean(options.verboseEvents);
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

    // Determine if any interactive cursor steps exist
    const hasInteractiveCursor = Boolean(
      plan?.steps?.some((s) =>
        s.cursor?.some((c) => c.split(' ').filter(Boolean).includes('agent'))
      )
    );

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
        hasInteractiveCursor,
      });
      return;
    }

    const provider = createProvider(this.options.provider ?? 'mock');
    // Load optional detectors override
    let patternsOverride: DetectorPatterns | undefined;
    if (this.options.detectorsPath) {
      try {
        const path = this.options.detectorsPath.startsWith('/')
          ? this.options.detectorsPath
          : `${cwd}/${this.options.detectorsPath}`;
        const raw = await readFile(path, 'utf8');
        const json = JSON.parse(raw) as {
          question?: string[];
          awaitingInput?: string[];
          completion?: string[];
        };
        patternsOverride = {
          question: json.question?.map((s) => new RegExp(s, 'i')),
          awaitingInput: json.awaitingInput?.map((s) => new RegExp(s, 'i')),
          completion: json.completion?.map((s) => new RegExp(s, 'i')),
        };
      } catch {
        // ignore invalid overrides
      }
    }
    this.detectors = new CursorDetectors({
      idleThresholdMs: this.options.idleMs ?? 5000,
      patterns: patternsOverride,
    });
    this.transcript = this.options.logDir
      ? new Transcript({ logDir: this.options.logDir })
      : undefined;

    const cursorBinary = this.options.cursorBinary ?? 'cursor-agent';
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

    if (hasInteractiveCursor) {
      this.process = new CursorProcess({
        cursorBinary,
        cwd,
      });

      await this.process.start([]);

      const system = baseSystemPrompt();
      const governing = await resolveGoverningPrompt(this.options.governingPrompt, cwd);

      this.process.onData(async (chunk) => {
        // Always mirror raw output to stdout (already done in CursorProcess), but ensure it's visible
        process.stdout.write('');
        this.transcript?.write({ ts: Date.now(), type: 'stdout', chunk });

        const eventType = this.detectors?.ingestChunk(chunk);
        if (!eventType) return;
        const event: OrchestratorEvent = { type: eventType } as OrchestratorEvent;
        if (this.verboseEvents) {
          // eslint-disable-next-line no-console
          console.log('[CursorPilot] event:', event.type);
        }
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
    }

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
            const isInteractive = parts.includes('agent');
            if (!isInteractive) {
              const cursorCmd = `${cursorBinary} ${cargs}`;
              const { exitCode, stdout, stderr } = await runShellCommand({ cmd: cursorCmd, cwd });
              // Mirror command output
              if (stdout) process.stdout.write(stdout);
              if (stderr) process.stderr.write(stderr);
              this.transcript?.write({
                ts: Date.now(),
                type: 'cursor-run',
                chunk: `$ ${cursorCmd}\n${stdout}${stderr}`,
              });
              if (exitCode !== 0) {
                this.transcript?.write({
                  ts: Date.now(),
                  type: 'cursor-error',
                  chunk: stderr || String(exitCode),
                });
                await this.stop();
                return;
              }
              continue;
            }
            await this.process?.execCursor(parts);
            const deadline = Date.now() + (this.options.cursorCmdTimeoutMs ?? 20000);
            let completed = false;
            let lastChunk = '';
            let buffer = '';
            const marker = '__CURSORPILOT_DONE__';
            const promptRe = /\n[^\n]*\$\s?$/; // crude shell prompt heuristic
            const onData = async (chunk: string) => {
              lastChunk = chunk;
              buffer += chunk;
              if (buffer.length > 10_000) buffer = buffer.slice(-10_000);
              if (buffer.includes(marker)) {
                completed = true;
                return;
              }
              const type = this.detectors?.ingestChunk(chunk);
              if (type === 'completed') {
                completed = true;
                return;
              }
              if (promptRe.test(buffer)) {
                completed = true;
              }
            };
            this.process?.onData(onData);
            while (Date.now() < deadline && !completed) {
              // eslint-disable-next-line no-await-in-loop
              await new Promise((r) => setTimeout(r, 200));
              if (/unknown option|not found/i.test(lastChunk)) {
                if (this.verboseEvents) {
                  // eslint-disable-next-line no-console
                  console.log('[CursorPilot] event:', 'cursor-error');
                }
                this.transcript?.write({ ts: Date.now(), type: 'cursor-error', chunk: lastChunk });
                await this.stop();
                return;
              }
            }
            if (!completed) {
              if (this.verboseEvents) {
                // eslint-disable-next-line no-console
                console.log('[CursorPilot] event:', 'cursor-timeout');
              }
              this.transcript?.write({ ts: Date.now(), type: 'cursor-timeout', chunk: cargs });
              await this.stop();
              return;
            }
          }
        }
      }
      this.transcript?.write({ ts: Date.now(), type: 'plan-completed' });
      await this.stop();
      return;
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
