#!/usr/bin/env node
import { Command } from "commander";
import { Orchestrator } from "@cursor-pilot/core";

const program = new Command();
program
  .name("cursor-pilot")
  .description("Drive Cursor CLI headlessly using LLM-powered answers")
  .version("0.0.0");

program
  .command("run")
  .description("Run a Cursor session")
  .option("--dry-run", "Do not spawn PTY; print intended actions", false)
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--cursor <bin>", "Cursor binary name/path", "cursor")
  .allowExcessArguments(false)
  .action(async (opts: { dryRun?: boolean; cwd?: string; cursor?: string }) => {
    const orchestrator = new Orchestrator({ cwd: opts.cwd, cursorBinary: opts.cursor });
    await orchestrator.start({ args: [], dryRun: opts.dryRun });
  });

program.parseAsync(process.argv);
