# CursorPilot

A TypeScript CLI that drives Cursor headlessly: it watches output, detects prompts, builds LLM prompts with context, and types answers back.

## Requirements
- Node 22+
- NPM 10+

## Install
```bash
npm install
```

## Build & Test
```bash
npm run typecheck
npm test
```

## Format & Lint
```bash
npm run biome:format
npm run biome:check
```

## Workspaces
- `@cursor-pilot/types`
- `@cursor-pilot/core`
- `@cursor-pilot/cli`
- `@cursor-pilot/detectors`

## Governing Prompt vs Plan
- Governing prompt (Markdown): the policy. It defines tone, constraints, safety rules, and priorities for every answer. Injected into every LLM call.
- Plan (YAML): the procedure. It defines an ordered set of steps with optional `run` (shell) and `cursor` (Cursor CLI args). Used to orchestrate what to execute.
- You can use one without the other. For “push until done” flows, keep the plan minimal (or omit it) and put acceptance criteria into the governing prompt.

### Example governing prompt (Markdown)
```markdown
Role: Senior TypeScript engineer.
Objective: Build a monorepo with CLI + core packages. Use strict TS, Vitest, Biome.
Style: Concise commits, small PR-sized increments.
Constraints:
- Never delete files without explicit confirmation.
- Prefer non-destructive actions; add tests for new logic.
Acceptance Criteria:
- `npm run typecheck` passes.
- `npm test` passes with at least one meaningful unit test per package.
- All files formatted and linted by Biome (no errors).
When unsure: Ask ONE short clarifying question first; otherwise proceed.
```

## Environment Variables
See `ENV_VARS.md` for supported variables and an example `.env`.

## Quickstart

```bash
npm run dev -- run \  
  --cwd "../zet" \
  --prompt "../zet/cursor-pilot/2025-10-01-governing-prompt-fix-tests.md" \
  --plan "../zet/cursor-pilot/plan-tests.yml"
```

## Quickstart (Dry Run)
```bash
# Show what would run, without spawning Cursor
npm run -w @cursor-pilot/cli build
node packages/cli/dist/index.js run --dry-run \
  --prompt "Role: Senior TS engineer." \
  --plan ./plan.yml
```

## Run with Transcript Logging
```bash
node packages/cli/dist/index.js run \
  --prompt "./prompts/governing.md" \
  --plan ./plan.yml \
  --log ./runs/sample-01
```

## Flags
- `--prompt <pathOrText>`: governing prompt (file path or literal)
- `--plan <path>`: path to `plan.yml`
- `--provider <name>`: `mock` (default) or `openai`
- `--model <id>`: model id for the provider
- `--temperature <num>`: sampling temperature (default 0)
- `--cursor <bin>`: Cursor binary name/path (default `cursor-agent`)
- `--cwd <path>`: working directory
- `--log <dir>`: directory to write transcript JSONL logs
- `--detectors <path>`: path to detectors JSON overrides (env: `CURSORPILOT_DETECTORS`)
- `--timeout-ms <num>`: maximum run time in milliseconds
- `--max-steps <num>`: maximum number of answers to type
- `--loop-breaker <num>`: stop if the same Q/A repeats N times
- `--idle-ms <num>`: idle threshold (ms) for inference when no prompt is detected (default 5000)
- `--auto-answer-idle` (flag): automatically type safe answers (y/n or numeric) on idle
- `--echo-answers` (flag): echo typed answers to stdout
- `--cursor-cmd-timeout-ms <num>`: timeout for each `cursor-agent` command (ms)
- `--dry-run`: do not spawn PTY; print intended actions

## Sample plan.yml
```yaml
name: "Bootstrap monorepo"
steps:
  - name: "Init repo"
    run:
      - echo "Ensure git initialized and deps installed"
  - name: "Cursor: scaffold service"
    cursor:
      - create service --name api --template express-ts
  - name: "Cursor: add tests"
    cursor:
      - generate tests --target packages/api
```

## Interactive Agent Demo
Use an interactive `cursor-agent agent` step to exercise the PTY + answering loop:

```yaml
name: "Agent demo"
steps:
  - name: "Cursor: show help"
    cursor:
      - --help
  - name: "Cursor: interactive agent"
    cursor:
      - agent --print "Hello from CursorPilot"
```

Run it (adjust the `--cursor` path for your system):
```bash
node packages/cli/dist/index.js run \
  --cursor "/Users/adam/.local/bin/cursor-agent" \
  --provider mock \
  --plan ./plan.yml \
  --echo-answers \
  --log ./runs/agent-01
```

- Non-interactive cursor commands run directly and exit cleanly.
- Interactive `agent` uses the PTY; output is mirrored, prompts are detected, and answers are typed. Use `--cursor-cmd-timeout-ms` to bound each command.

## Notes
- Providers: `mock` is bundled for tests; `openai` stub requires `OPENAI_API_KEY`.
- Detectors: configurable defaults under `@cursor-pilot/detectors`.

## Live Output and Events

- **--verbose-events**: Print orchestrator event types (e.g., `running`, `idle`, `question`, `awaitingInput`, `completed`).
  - CLI: `--verbose-events`
  - Env: `CURSORPILOT_VERBOSE_EVENTS=true`
- **Output mirroring**: Non-interactive command stdout/stderr are mirrored directly to the console so you can see what Cursor (or the mock agent) prints.
- **Echo answers**: Show what CursorPilot types back to the agent.
  - CLI: `--echo-answers`
  - Env: `ECHO_ANSWERS=true`
- **LLM logging**: Persist full LLM prompts and responses into the transcript (JSONL).
  - CLI: `--log-llm`
  - Env: `CURSORPILOT_LOG_LLM=true`

Example:
```bash
node packages/cli/dist/index.js run \
  --cursor "node scripts/mock-cursor-agent.mjs" \
  --plan ./plan-mock.yml \
  --provider mock \
  --verbose-events \
  --log-llm \
  --echo-answers \
  --idle-ms 1000 \
  --auto-answer-idle
```
