#!/usr/bin/env node
import { Orchestrator } from '@cursor-pilot/core';
import { Command } from 'commander';

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
  .option('--cursor <bin>', 'Cursor binary name/path', 'cursor')
  .option('--provider <name>', 'LLM provider (openai|mock)', 'mock')
  .option('--model <id>', 'Model id for provider')
  .option('--temperature <num>', 'Sampling temperature', (v) => Number(v), 0)
  .option('--prompt <pathOrText>', 'Governing prompt path or literal text')
  .option('--plan <path>', 'Path to plan.yml')
  .option('--log <dir>', 'Directory to write transcript logs')
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
    }) => {
      const orchestrator = new Orchestrator({
        cwd: opts.cwd,
        cursorBinary: opts.cursor,
        provider: opts.provider,
        model: opts.model,
        temperature: opts.temperature,
        governingPrompt: opts.prompt,
        planPath: opts.plan,
        logDir: opts.log,
      } as any);
      await orchestrator.start({ args: [], dryRun: opts.dryRun });
    }
  );

program.parseAsync(process.argv);
