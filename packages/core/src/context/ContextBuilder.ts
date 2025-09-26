import { probeFS } from '../context/FileSystemProbe.js';

/** Input required to build an LLM-ready context snapshot. */
export type BuildInput = {
  /** Optional governing prompt content */
  governingPrompt?: string;
  /** Recent terminal output window */
  recentOutput: string;
  /** Optional plan step information */
  planContext?: string;
  /** Working directory for FS probing */
  cwd: string;
};

/** Materialized prompt payloads for the provider. */
export type BuiltContext = {
  /** Fully rendered user prompt content */
  userPrompt: string;
};

/** Build the user prompt from governing prompt, recent output, and FS snapshot. */
export async function buildContext(input: BuildInput): Promise<BuiltContext> {
  const fs = await probeFS({ cwd: input.cwd });

  const parts: string[] = [];
  if (input.governingPrompt) parts.push(`Governing Prompt:\n${input.governingPrompt}`);
  if (input.planContext) parts.push(`Plan Context:\n${input.planContext}`);
  parts.push(`Recent Output:\n${input.recentOutput}`);
  if (fs.changedFiles.length > 0) {
    parts.push(`Changed Files (last 10):\n${fs.changedFiles.slice(-10).join('\n')}`);
  }

  return { userPrompt: parts.join('\n\n') };
}
