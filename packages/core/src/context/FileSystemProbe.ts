import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

/** Snapshot of lightweight git state for context building. */
export type FSSnapshot = {
  /** Raw porcelain status output */
  status: string;
  /** List of changed files from git diff */
  changedFiles: string[];
};

/** Probe git status and diff to summarize recent filesystem changes. */
export async function probeFS({ cwd }: { cwd: string }): Promise<FSSnapshot> {
  const { stdout: status } = await exec('git status --porcelain', { cwd });
  const { stdout: changed } = await exec('git diff --name-only', { cwd });
  return {
    status: status.trim(),
    changedFiles: changed
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
