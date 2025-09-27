#!/usr/bin/env node
import { Orchestrator } from '@cursor-pilot/core';
import { Command } from 'commander';
import dotenv from 'dotenv';

dotenv.config();

const envTimeout = process.env.CURSORPILOT_TIMEOUT_MS
  ? Number(process.env.CURSORPILOT_TIMEOUT_MS)
  : undefined;
const envMaxSteps = process.env.CURSORPILOT_MAX_STEPS
  ? Number(process.env.CURSORPILOT_MAX_STEPS)
  : undefined;
const envLoopBreaker = process.env.CURSORPILOT_LOOP_BREAKER
  ? Number(process.env.CURSORPILOT_LOOP_BREAKER)
  : undefined;
const envIdleMs = process.env.CURSORPILOT_IDLE_MS ? Number(process.env.CURSORPILOT_IDLE_MS) : 5000;
const envAutoAnswerIdle = Boolean(
  process.env.CURSORPILOT_AUTO_ANSWER_IDLE &&
    process.env.CURSORPILOT_AUTO_ANSWER_IDLE !== '0' &&
    process.env.CURSORPILOT_AUTO_ANSWER_IDLE.toLowerCase() !== 'false'
);
const envEchoAnswers = Boolean(
  process.env.ECHO_ANSWERS &&
    process.env.ECHO_ANSWERS !== '0' &&
    process.env.ECHO_ANSWERS.toLowerCase() !== 'false'
);
const envCursorCmdTimeoutMs = process.env.CURSORPILOT_CURSOR_CMD_TIMEOUT_MS
  ? Number(process.env.CURSORPILOT_CURSOR_CMD_TIMEOUT_MS)
  : 20000;
const envDetectorsPath = process.env.CURSORPILOT_DETECTORS;
const envVerboseEvents = Boolean(
  process.env.CURSORPILOT_VERBOSE_EVENTS &&
    process.env.CURSORPILOT_VERBOSE_EVENTS !== '0' &&
    process.env.CURSORPILOT_VERBOSE_EVENTS.toLowerCase() !== 'false'
);
const envAutoApprove = Boolean(
  process.env.CURSORPILOT_AUTO_APPROVE &&
    process.env.CURSORPILOT_AUTO_APPROVE !== '0' &&
    process.env.CURSORPILOT_AUTO_APPROVE.toLowerCase() !== 'false'
);
const envEchoGoverning = Boolean(
  process.env.CURSORPILOT_ECHO_GOVERNING &&
    process.env.CURSORPILOT_ECHO_GOVERNING !== '0' &&
    process.env.CURSORPILOT_ECHO_GOVERNING.toLowerCase() !== 'false'
);
const envLogLLM = Boolean(
  process.env.CURSORPILOT_LOG_LLM &&
    process.env.CURSORPILOT_LOG_LLM !== '0' &&
    process.env.CURSORPILOT_LOG_LLM.toLowerCase() !== 'false'
);

const program = new Command();
program
  .name('cursor-pilot')
  .description('Drive Cursor CLI headlessly using LLM-powered answers')
  .version('0.0.0');

program
  .command('run')
  .description('Run a Cursor session')
  .option('--dry-run', 'Do not spawn PTY; print intended actions', false)
  .option('--cwd <path>', 'Working directory', process.cwd())
  .option('--cursor <bin>', 'Cursor binary name/path', 'cursor-agent')
  .option(
    '--provider <name>',
    'LLM provider (openai|mock)',
    process.env.CURSORPILOT_PROVIDER ?? 'mock'
  )
  .option('--model <id>', 'Model id for provider', process.env.CURSORPILOT_MODEL)
  .option('--temperature <num>', 'Sampling temperature', (v) => Number(v), 0)
  .option('--prompt <pathOrText>', 'Governing prompt path or literal text')
  .option('--plan <path>', 'Path to plan.yml')
  .option('--log <dir>', 'Directory to write transcript logs', process.env.CURSORPILOT_LOG_DIR)
  .option('--detectors <path>', 'Path to detectors JSON overrides', envDetectorsPath)
  .option(
    '--print-config',
    'Print effective config before run',
    Boolean(process.env.CURSORPILOT_PRINT_CONFIG)
  )
  .option('--log-llm', 'Log LLM prompts and responses to transcript', envLogLLM)
  .option('--timeout-ms <num>', 'Maximum run time in milliseconds', (v) => Number(v), envTimeout)
  .option('--max-steps <num>', 'Maximum number of answers to type', (v) => Number(v), envMaxSteps)
  .option(
    '--loop-breaker <num>',
    'Stop if same Q/A repeats N times',
    (v) => Number(v),
    envLoopBreaker
  )
  .option('--idle-ms <num>', 'Idle threshold for inference (ms)', (v) => Number(v), envIdleMs)
  .option(
    '--auto-answer-idle',
    'Automatically type safe answers on idle (y/n or numeric)',
    envAutoAnswerIdle
  )
  .option('--echo-answers', 'Echo typed answers to stdout', envEchoAnswers)
  .option('--auto-approve', 'Auto-approve Cursor run prompts', envAutoApprove)
  .option('--echo-governing', 'Echo governing prompt content to console', envEchoGoverning)
  .option(
    '--cursor-cmd-timeout-ms <num>',
    'Timeout for each cursor-agent command (ms)',
    (v) => Number(v),
    envCursorCmdTimeoutMs
  )
  .option('--verbose-events', 'Print event types to stdout', envVerboseEvents)
  .allowExcessArguments(false)
  .action(
    async (opts: {
      dryRun?: boolean;
      cwd?: string;
      cursor?: string;
      provider?: 'openai' | 'mock';
      model?: string;
      temperature?: number;
      prompt?: string;
      plan?: string;
      log?: string;
      timeoutMs?: number;
      maxSteps?: number;
      loopBreaker?: number;
      idleMs?: number;
      autoAnswerIdle?: boolean;
      echoAnswers?: boolean;
      autoApprove?: boolean;
      echoGoverning?: boolean;
      cursorCmdTimeoutMs?: number;
      detectors?: string;
      verboseEvents?: boolean;
      logLlm?: boolean;
      printConfig?: boolean;
    }) => {
      const effective = {
        cwd: opts.cwd,
        cursorBinary: opts.cursor,
        provider: opts.provider,
        model: opts.model,
        temperature: opts.temperature,
        governingPrompt: opts.prompt,
        planPath: opts.plan,
        logDir: opts.log,
        timeoutMs: opts.timeoutMs,
        maxSteps: opts.maxSteps,
        loopBreaker: opts.loopBreaker,
        idleMs: opts.idleMs,
        autoAnswerIdle: opts.autoAnswerIdle,
        echoAnswers: opts.echoAnswers,
        cursorCmdTimeoutMs: opts.cursorCmdTimeoutMs,
        detectorsPath: opts.detectors,
        verboseEvents: opts.verboseEvents,
        logLlm: opts.logLlm,
      } as const;

      if (opts.printConfig) {
        // eslint-disable-next-line no-console
        console.log('[CursorPilot] Effective config:', effective);
      }

      const orchestrator = new Orchestrator({
        ...effective,
        autoApprovePrompts: opts.autoApprove,
        echoGoverning: opts.echoGoverning,
      } as any);
      await orchestrator.start({ args: [], dryRun: opts.dryRun });
    }
  );

program.parseAsync(process.argv);
