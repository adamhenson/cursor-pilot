import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(_exec);

export type FSSnapshot = {
  status: string;
  changedFiles: string[];
};

export async function probeFS({ cwd }: { cwd: string }): Promise<FSSnapshot> {
  const { stdout: status } = await exec("git status --porcelain", { cwd });
  const { stdout: changed } = await exec("git diff --name-only", { cwd });
  return {
    status: status.trim(),
    changedFiles: changed
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
