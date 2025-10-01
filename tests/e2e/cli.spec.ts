import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const execAsync = promisify(exec);

/**
 * E2E tests for CursorPilot CLI functionality
 */
test.describe('CursorPilot CLI', () => {
  const mockCursorPath = path.join(__dirname, 'fixtures', 'mock-cursor-agent.js');
  const testPlanPath = path.join(__dirname, 'fixtures', 'test-plan.yml');
  const testPromptPath = path.join(__dirname, 'fixtures', 'test-prompt.md');
  const cliPath = path.join(__dirname, '..', '..', 'packages', 'cli', 'dist', 'index.js');

  test.beforeAll(async () => {
    // Build the CLI package
    await execAsync('npm run build', { cwd: path.join(__dirname, '..', '..', 'packages', 'cli') });
  });

  test('should show help when run without arguments', async () => {
    const { stdout, stderr } = await execAsync(`node ${cliPath} --help`);

    expect(stdout).toContain('Drive Cursor CLI headlessly using LLM-powered answers');
    expect(stdout).toContain('run');
    expect(stderr).toBe('');
  });

  test('should show version information', async () => {
    const { stdout, stderr } = await execAsync(`node ${cliPath} --version`);

    expect(stdout.trim()).toBe('0.0.0');
    expect(stderr).toBe('');
  });

  test('should run in dry-run mode without spawning PTY', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${cliPath} run --dry-run --cursor ${mockCursorPath} --prompt "Test prompt" --plan ${testPlanPath}`,
      { timeout: 10000 }
    );

    expect(stdout).toContain('[CursorPilot] Dry run: would start Cursor with:');
    expect(stdout).toContain('cursor-agent');
    expect(stdout).toContain('provider: mock');
    expect(stderr).toBe('');
  });

  test('should handle missing cursor binary gracefully', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${cliPath} run --cursor nonexistent-binary --prompt "Test prompt"`,
      { timeout: 10000 }
    );

    expect(stdout).toContain('[CursorPilot] Cursor binary not found on PATH: nonexistent-binary');
    expect(stderr).toBe('');
  });

  test('should accept various command line options', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${cliPath} run --dry-run --cursor ${mockCursorPath} --provider mock --model test-model --temperature 0.5 --timeout-ms 30000 --max-steps 10 --idle-ms 2000 --auto-answer-idle --auto-approve`,
      { timeout: 10000 }
    );

    expect(stdout).toContain('[CursorPilot] Dry run: would start Cursor with:');
    expect(stdout).toContain('provider: mock');
    expect(stdout).toContain('model: test-model');
    expect(stdout).toContain('temperature: 0.5');
    expect(stdout).toContain('timeoutMs: 30000');
    expect(stdout).toContain('maxSteps: 10');
    expect(stdout).toContain('idleMs: 2000');
    expect(stdout).toContain('autoAnswerIdle: true');
    expect(stderr).toBe('');
  });

  test('should load governing prompt from file', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${cliPath} run --dry-run --cursor ${mockCursorPath} --prompt ${testPromptPath}`,
      { timeout: 10000 }
    );

    expect(stdout).toContain('[CursorPilot] Dry run: would start Cursor with:');
    expect(stderr).toBe('');
  });

  test('should load plan from file', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${cliPath} run --dry-run --cursor ${mockCursorPath} --plan ${testPlanPath}`,
      { timeout: 10000 }
    );

    expect(stdout).toContain('[CursorPilot] Dry run: would start Cursor with:');
    expect(stdout).toContain('plan:');
    expect(stdout).toContain('E2E Test Plan');
    expect(stderr).toBe('');
  });

  test('should print effective config when requested', async () => {
    const { stdout, stderr } = await execAsync(
      `node ${cliPath} run --dry-run --cursor ${mockCursorPath} --print-config`,
      { timeout: 10000 }
    );

    expect(stdout).toContain('[CursorPilot] Effective config:');
    expect(stdout).toContain('cursorBinary');
    expect(stdout).toContain('provider');
    expect(stderr).toBe('');
  });
});
