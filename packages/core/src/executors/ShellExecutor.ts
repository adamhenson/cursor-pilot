import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(exec);

/** Run a shell command and capture stdout/stderr and exit code. */
export async function runShellCommand({
  cmd,
  cwd,
}: {
  cmd: string;
  cwd: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await pexec(cmd, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout: stdout as string, stderr: stderr as string };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return { exitCode: (e.code as number) ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}
