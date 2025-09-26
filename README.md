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
- `--cursor <bin>`: Cursor binary name/path (default `cursor`)
- `--cwd <path>`: working directory
- `--log <dir>`: directory to write transcript JSONL logs
- `--dry-run`: do not spawn PTY; print intended actions

## Sample plan.yml
```yaml
name: "Bootstrap monorepo"
steps:
  - name: Init repo
    run:
      - echo "Ensure git initialized and deps installed"
  - name: Cursor: scaffold service
    cursor:
      - create service --name api --template express-ts
  - name: Cursor: add tests
    cursor:
      - generate tests --target packages/api
```

## Notes
- Providers: `mock` is bundled for tests; `openai` stub requires `OPENAI_API_KEY`.
- Detectors: configurable defaults under `@cursor-pilot/detectors`.
