import { probeFS } from "./FileSystemProbe.js";

export type BuildInput = {
  governingPrompt?: string;
  recentOutput: string;
  planContext?: string;
  cwd: string;
};

export type BuiltContext = {
  userPrompt: string;
};

export async function buildContext(input: BuildInput): Promise<BuiltContext> {
  const fs = await probeFS({ cwd: input.cwd });

  const parts: string[] = [];
  if (input.governingPrompt) parts.push(`Governing Prompt:\n${input.governingPrompt}`);
  if (input.planContext) parts.push(`Plan Context:\n${input.planContext}`);
  parts.push(`Recent Output:\n${input.recentOutput}`);
  if (fs.changedFiles.length > 0) {
    parts.push(`Changed Files (last 10):\n${fs.changedFiles.slice(-10).join("\n")}`);
  }

  return { userPrompt: parts.join("\n\n") };
}
