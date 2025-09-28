import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ESM typed but fine to import in NodeNext
// import logUpdate from 'log-update';
import { createRequire } from 'node:module';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - CJS module without types
import createAnsiDiff from 'ansi-diff-stream';
import { buildContext } from '../context/ContextBuilder.js';
import { CursorDetectors } from '../cursor/CursorDetectors.js';
import type { DetectorPatterns } from '../cursor/CursorDetectors.js';
import { CursorProcess } from '../cursor/CursorProcess.js';
import { runShellCommand } from '../executors/ShellExecutor.js';
import { type ProviderName, createProvider } from '../llm/ProviderFactory.js';
import { loadPlan } from '../plan/PlanLoader.js';
import { baseSystemPrompt } from '../prompts/systemPrompt.js';
import { MarkdownTranscript } from '../telemetry/MarkdownTranscript.js';
import { Tui } from '../telemetry/Tui.js';

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
  /** Whether to log prompts and responses to transcript */
  logLlm?: boolean;
  /** Whether to auto-approve run prompts without asking the LLM */
  autoApprovePrompts?: boolean;
  /** Whether to echo governing prompt content when seeding */
  echoGoverning?: boolean;
  /** Optional transcript cap for last N lines */
  transcriptMaxLines?: number;
  /** Whether to render compact TUI (suppresses raw stdout mirror) */
  tui?: boolean;
  /** Whether to render compact buffered console output */
  compactConsole?: boolean;
  /** Whether to print only important/highlight events to console */
  importantOnly?: boolean;
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
  private transcript: MarkdownTranscript | undefined;
  private answersTyped = 0;
  private lastQAHash: string | undefined;
  private repeatedCount = 0;
  private stopTimer: NodeJS.Timeout | undefined;
  private consecutiveIdle = 0;
  private readonly verboseEvents: boolean;
  private readonly logLlm: boolean;
  private readonly autoApprovePrompts: boolean;
  private readonly echoGoverning: boolean;
  private seedNudgeTimer: NodeJS.Timeout | undefined;
  private approvalPhase: 'none' | 'sentEnter' | 'sentY' = 'none';
  private approvalFallbackTimer: NodeJS.Timeout | undefined;
  private trustedWorkspace = false;
  private readonly useTui: boolean;
  private tui: Tui | undefined;
  private readonly compactConsole: boolean = false;
  private compactBuffer = '';
  private compactTimer: NodeJS.Timeout | undefined;
  private readonly importantOnly: boolean = false;
  private lastFrameLines: string[] = [];
  private diffStream: any;
  private compactTerm: any;

  /** Construct a new orchestrator with the provided options. */
  public constructor(options: OrchestratorOptions = {}) {
    this.options = options;
    this.verboseEvents = Boolean(options.verboseEvents);
    this.logLlm = Boolean(options.logLlm);
    this.autoApprovePrompts = Boolean(options.autoApprovePrompts);
    this.echoGoverning = Boolean(options.echoGoverning);
    this.useTui = Boolean(options.tui);
    this.compactConsole = Boolean(options.compactConsole);
    this.importantOnly = Boolean(options.importantOnly);
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

    // Resolve governing prompt text early so it's available across flows
    const governingText = await resolveGoverningPrompt(this.options.governingPrompt, cwd);

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
      ? new MarkdownTranscript({ logDir: this.options.logDir })
      : undefined;
    if (this.useTui) this.tui = new Tui();

    const cursorBinary = this.options.cursorBinary ?? 'cursor-agent';
    const which = await runShellCommand({ cmd: `command -v ${cursorBinary}`, cwd });
    if (which.exitCode !== 0) {
      const msg = `Cursor binary not found on PATH: ${cursorBinary}. Install it or pass --cursor.`;
      // eslint-disable-next-line no-console
      console.error(`[CursorPilot] ${msg}`);
      this.transcript?.heading('Cursor binary not found');
      this.transcript?.note(msg);
      return;
    }

    if (this.options.timeoutMs && this.options.timeoutMs > 0) {
      this.stopTimer = setTimeout(async () => {
        this.transcript?.note('Run timed out');
        await this.stop();
      }, this.options.timeoutMs);
    }

    if (hasInteractiveCursor) {
      this.process = new CursorProcess({
        cursorBinary,
        cwd,
      });

      await this.process.start([]);
      if (this.compactConsole && !this.useTui) {
        this.diffStream = createAnsiDiff();
        this.diffStream.pipe(process.stdout);
        // Hidden headless xterm to normalize ANSI into a stable viewport
        const require = createRequire(import.meta.url);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const XHeadless = require('@xterm/headless');
        const TerminalCtor = XHeadless.Terminal || XHeadless.default?.Terminal || XHeadless;
        const cols = (process.stdout as any).columns || 120;
        const rows = (process.stdout as any).rows || 40;
        this.compactTerm = new TerminalCtor({
          cols,
          rows,
          allowProposedApi: true,
          disableStdin: true,
        });
        // Resize with host terminal
        if (process.stdout && typeof (process.stdout as any).on === 'function') {
          (process.stdout as any).on('resize', () => {
            try {
              const ncols = (process.stdout as any).columns || cols;
              const nrows = (process.stdout as any).rows || rows;
              this.compactTerm?.resize(ncols, nrows);
            } catch {}
          });
        }
      }

      const system = baseSystemPrompt();

      this.process.onData(async (chunk) => {
        // Mirror raw PTY output exactly when not using special renderers
        if (!this.useTui && !this.compactConsole && !this.importantOnly) {
          process.stdout.write(chunk);
        }
        // We no longer store raw stdout lines in transcript
        if (this.useTui) this.tui?.append(chunk);
        if (this.compactConsole && !this.useTui) {
          // Write raw chunk to hidden xterm to interpret CR/ANSI correctly
          this.compactTerm?.write(chunk);
          this.compactBuffer += chunk;
          if (this.compactTimer) clearTimeout(this.compactTimer);
          this.compactTimer = setTimeout(() => {
            const nextFrame = this.compactTerm
              ? getViewportFrame(this.compactTerm)
              : collapseAnsi(this.compactBuffer);
            if (this.diffStream) {
              this.diffStream.write(`${nextFrame}\n`);
            } else {
              renderAtomicFrame({
                next: nextFrame,
                prevLines: this.lastFrameLines,
              });
              this.lastFrameLines = nextFrame.split('\n');
            }
            this.compactBuffer = '';
          }, 150);
        }
        if (this.importantOnly && !this.useTui) {
          const highlight = extractHighlight(chunk);
          if (highlight) {
            // eslint-disable-next-line no-console
            console.log(highlight);
          }
        }
        // In TUI mode we mirror raw PTY output only (no overlay rendering)

        // Auto-accept workspace trust prompt if detected
        if (
          !this.trustedWorkspace &&
          (/Workspace Trust Required/i.test(chunk) || /Trust this workspace/i.test(chunk))
        ) {
          this.trustedWorkspace = true;
          await this.process?.write('a');
          await new Promise((r) => setTimeout(r, 300));
          await this.process?.write('');
          this.transcript?.note('Auto-trusted workspace');
          return;
        }

        const isApprovalPrompt =
          /Run this command\?/i.test(chunk) || /Not in allowlist:/i.test(chunk);
        // Handle run confirmation prompts
        if (isApprovalPrompt) {
          if (this.autoApprovePrompts) {
            // Wait until options line is visible to press Enter
            const hasOptions = /(Run\s*\(y\)\s*\(enter\))/i.test(chunk);
            if (this.approvalPhase === 'none' && !hasOptions) {
              this.approvalPhase = 'sentEnter';
              // Small delay to allow options to render, then press Enter
              await new Promise((r) => setTimeout(r, 150));
              await this.process?.write('');
              this.transcript?.cursorHighlight('Auto-approve: pressed Enter');
              // Fallback: if prompt persists after 900ms, send 'y'
              if (this.approvalFallbackTimer) clearTimeout(this.approvalFallbackTimer);
              this.approvalFallbackTimer = setTimeout(async () => {
                if (this.approvalPhase === 'sentEnter') {
                  await this.process?.write('y');
                  this.transcript?.cursorHighlight('Auto-approve fallback: typed y');
                  this.approvalPhase = 'sentY';
                }
              }, 900);
              return;
            }
            if (this.approvalPhase === 'sentEnter') {
              await this.process?.write('y');
              this.transcript?.cursorHighlight('Auto-approve: typed y');
              this.approvalPhase = 'sentY';
              return;
            }
            // already sent Y; do nothing
            return;
          }
          // Otherwise, send to LLM as a question
          const { userPrompt } = await buildContext({
            governingPrompt: governingText,
            recentOutput: chunk,
            cwd,
          });
          this.transcript?.llmExchange({ system, user: userPrompt, response: '' });
          try {
            const { text } = await provider.complete({
              system,
              user: userPrompt,
              maxTokens: 16,
              temperature: this.options.temperature ?? 0,
            });
            this.transcript?.llmExchange({ system, user: userPrompt, response: text });
            await this.process?.write(text);
            return;
          } catch (err: any) {
            this.transcript?.note(`LLM error: ${String(err?.message ?? err)}`);
          }
        }

        // Reset approval phase when prompt not present in this chunk
        if (!isApprovalPrompt) {
          this.approvalPhase = 'none';
          if (this.approvalFallbackTimer) clearTimeout(this.approvalFallbackTimer);
        }

        const eventType = this.detectors?.ingestChunk(chunk);
        if (!eventType) return;
        // Event markers omitted from transcript

        if (eventType === 'idle') {
          this.consecutiveIdle += 1;
          if (this.consecutiveIdle >= 2) {
            const { userPrompt } = await buildContext({
              governingPrompt: governingText,
              recentOutput: chunk,
              cwd,
            });
            const { text } = await provider.complete({
              system,
              user: userPrompt,
              maxTokens: 32,
              temperature: this.options.temperature ?? 0,
            });
            this.transcript?.llmExchange({ system, user: userPrompt, response: text });
            if (this.options.autoAnswerIdle && text && text.trim().length > 0) {
              await this.process?.write(text);
            }
          }
          return;
        }
        this.consecutiveIdle = 0;

        if (eventType === 'question' || eventType === 'awaitingInput') {
          if (this.options.maxSteps && this.answersTyped >= this.options.maxSteps) {
            this.transcript?.note('Max steps reached');
            await this.stop();
            return;
          }

          const { userPrompt } = await buildContext({
            governingPrompt: governingText,
            recentOutput: chunk,
            cwd,
          });
          const { text } = await provider.complete({
            system,
            user: userPrompt,
            maxTokens: 200,
            temperature: this.options.temperature ?? 0,
          });
          this.transcript?.llmExchange({ system, user: userPrompt, response: text });

          const qaHash = `${eventType}|${text}`;
          if (this.lastQAHash === qaHash) {
            this.repeatedCount += 1;
            if (this.options.loopBreaker && this.repeatedCount >= this.options.loopBreaker) {
              this.transcript?.note('Loop breaker triggered');
              await this.stop();
              return;
            }
          } else {
            this.lastQAHash = qaHash;
            this.repeatedCount = 0;
          }

          // Mirror output only; no extra logging
          await this.process?.write(text);
          this.answersTyped += 1;
        }
      });
    }

    // Execute plan steps sequentially (basic version)
    if (plan?.steps?.length) {
      let interactiveStarted = false;
      for (const step of plan.steps) {
        if (step.run?.length) {
          for (const cmd of step.run) {
            const { exitCode, stdout, stderr } = await runShellCommand({ cmd, cwd });
            this.transcript?.cursorHighlight(`$ ${cmd}`);
            if (exitCode !== 0) {
              this.transcript?.note(`Run error: ${cmd}`);
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
              this.transcript?.cursorHighlight(`$ ${cursorCmd}`);
              if (exitCode !== 0) {
                this.transcript?.note(`Cursor error: ${stderr || String(exitCode)}`);
                await this.stop();
                return;
              }
              continue;
            }
            await this.process?.execCursor(parts);
            // Inject governing prompt once at startup to orient the agent
            if (governingText && governingText.trim().length > 0) {
              if (this.options.echoAnswers && !this.useTui)
                console.log('[CursorPilot] typed: [governing prompt]');
              await new Promise((r) => setTimeout(r, 500));
              await this.process?.write(governingText);
              await new Promise((r) => setTimeout(r, 300));
              await this.process?.write('');
              if (this.echoGoverning && !this.useTui) {
                // eslint-disable-next-line no-console
                console.log('[CursorPilot] governing prompt:\n', governingText);
              }
              this.transcript?.seedPrompt(governingText);
              // After seeding, if still idle after 3s, send a small nudge
              if (this.seedNudgeTimer) clearTimeout(this.seedNudgeTimer);
              this.seedNudgeTimer = setTimeout(async () => {
                if (this.options.echoAnswers && !this.useTui) {
                  // eslint-disable-next-line no-console
                  console.log('[CursorPilot] typed: [nudge Enter]');
                }
                await this.process?.write('');
                await new Promise((r) => setTimeout(r, 200));
                if (this.options.echoAnswers && !this.useTui) {
                  // eslint-disable-next-line no-console
                  console.log('[CursorPilot] typed: Auto');
                }
                await this.process?.write('Auto');
                this.transcript?.note('Sent idle nudge');
              }, 3000);
            }
            // Mark interactive session started; subsequent plan steps are skipped
            interactiveStarted = true;
            break;
          }
        }
        if (interactiveStarted) break;
      }
      if (interactiveStarted) {
        // Keep session open; interactive flow continues via onData handlers
        return;
      }
      this.transcript?.note('Plan completed');
      await this.stop();
      return;
    }
  }

  /** Stop the run session and clean up the PTY process. */
  public async stop(): Promise<void> {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    if (this.seedNudgeTimer) clearTimeout(this.seedNudgeTimer);
    if (this.approvalFallbackTimer) clearTimeout(this.approvalFallbackTimer);
    if (this.compactTimer) clearTimeout(this.compactTimer);
    await this.process?.dispose();
    if (this.tui) this.tui.destroy();
    this.transcript?.close();
    this.process = undefined;
  }
}

function stripAnsi(input: string): string {
  let result = '';
  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input.charCodeAt(i);
    if (c === 0x1b && i + 1 < n) {
      const next = input.charAt(i + 1);
      if (next === '[') {
        i += 2;
        while (i < n) {
          const ch = input.charAt(i);
          if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }
      if (next === ']') {
        i += 2;
        while (i < n && input.charCodeAt(i) !== 0x07) i += 1;
        if (i < n) i += 1;
        continue;
      }
    }
    result += input.charAt(i);
    i += 1;
  }
  return result;
}

function collapseAnsi(input: string): string {
  // Very simple frame collapse: remove OSC sequences, interpret CR as line reset, and strip cursor-position sequences
  let out = '';
  let line = '';
  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input.charCodeAt(i);
    if (c === 0x1b && i + 1 < n) {
      const next = input.charAt(i + 1);
      if (next === '[') {
        // skip CSI sequence
        i += 2;
        while (i < n) {
          const ch = input.charAt(i);
          if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }
      if (next === ']') {
        // skip OSC sequence to BEL
        i += 2;
        while (i < n && input.charCodeAt(i) !== 0x07) i += 1;
        if (i < n) i += 1;
        continue;
      }
    }
    if (c === 0x0d) {
      // CR: reset current line
      line = '';
      i += 1;
      continue;
    }
    if (c === 0x0a) {
      out += `${line}\n`;
      line = '';
      i += 1;
      continue;
    }
    line += input.charAt(i);
    i += 1;
  }
  if (line.length > 0) out += `${line}`;
  return out;
}

function extractHighlight(input: string): string | undefined {
  const s = stripAnsi(input);
  // Cursor UI labels
  const planMatch = s.match(/\b(Add a follow-up|Generating|Listed|Listing|Running|Reading)\b.*$/m);
  if (planMatch) return `[Cursor] ${planMatch[0].trim()}`;
  // Pasted text notices
  const pasted = s.match(/Pasted text #\d+ \+\d+ lines/);
  if (pasted) return `[Cursor] ${pasted[0]}`;
  // Approvals
  if (/Run this command\?/i.test(s)) return '[Cursor] Waiting for approval';
  if (/Not in allowlist:/i.test(s)) return '[Cursor] Not in allowlist';
  // Shell lines starting with $ commands
  const cmd = s.match(/^\s*\$\s+.+$/m);
  if (cmd) return cmd[0].trim();
  // Errors
  const err = s.match(/(error|failed|cannot|timeout)/i);
  if (err) return s.trim().slice(0, 200);
  return undefined;
}

function getViewportFrame(term: any): string {
  const lines: string[] = [];
  const buffer = term.buffer.active;
  const viewportTop = buffer.viewportY ?? 0;
  const rows = term.rows ?? 40;
  const end = Math.min(buffer.length, viewportTop + rows);
  const start = Math.max(0, end - rows);
  for (let y = start; y < end; y += 1) {
    const line = buffer.getLine(y);
    lines.push(line ? line.translateToString() : '');
  }
  return lines.join('\n');
}
function renderAtomicFrame({
  next,
  prevLines,
}: {
  next: string;
  prevLines: string[];
}): void {
  const nextLines = next.split('\n');
  // Hide cursor during redraw
  process.stdout.write('\x1b[?25l');
  // Move cursor home
  process.stdout.write('\x1b[H');
  const maxLines = Math.max(prevLines.length, nextLines.length);
  for (let i = 0; i < maxLines; i += 1) {
    const prevLine = prevLines[i] ?? '';
    const nextLine = nextLines[i] ?? '';
    if (prevLine === nextLine) {
      // Move to next line without writing
      process.stdout.write('\x1b[1B\r');
      continue;
    }
    // Clear current line and write new content
    process.stdout.write('\x1b[2K');
    process.stdout.write(nextLine);
    // Move to next line
    process.stdout.write('\r\n');
  }
  // If new frame has fewer lines, clear the rest of old content
  if (nextLines.length < prevLines.length) {
    for (let i = nextLines.length; i < prevLines.length; i += 1) {
      process.stdout.write('\x1b[2K\r\n');
    }
  }
  // Move cursor back to last line start
  process.stdout.write('\r');
  // Show cursor
  process.stdout.write('\x1b[?25h');
}
