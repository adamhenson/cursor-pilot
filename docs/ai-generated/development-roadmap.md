# AI Cursor Driver — Phased Development Roadmap

This roadmap translates `docs/design.md` into concrete phases with clear objectives, deliverables, acceptance criteria, and risks. We’ll work iteratively, landing small, verifiable milestones behind conventional commits and CI-friendly scripts.

---

## Conventions
- **Commits**: conventional commits (e.g., `feat(core): ...`, `docs(roadmap): ...`).
- **Type safety**: TypeScript strict mode across workspaces.
- **Scripts**: root `typecheck` fans out to all workspaces; each workspace exposes its own `typecheck`, `build`, and `test` scripts.
- **Docs**: update `docs/` and `docs/ai-generated/` as features land.

---

## Phase 0 — Repo Bootstrap (Completed)
- Objectives
  - Initialize repo, workspaces, Biome, and basic scripts.
- Deliverables
  - Root `package.json` with workspaces, Biome config, `.gitignore`.
- Acceptance
  - `npm install` works; `biome check .` runs.

---

## Phase 1 — Workspace Skeleton
- Objectives
  - Create the monorepo structure matching the design.
- Deliverables
  - Packages: `@ai-cursor/types`, `@ai-cursor/core`, `@ai-cursor/cli`, `@ai-cursor/detectors`.
  - Root `tsconfig.json`; per-package `tsconfig.json` and `package.json`.
  - Minimal exports and placeholder code; `typecheck`, `build`, `test` scripts per package.
- Acceptance
  - `npm run typecheck` passes at root.
  - `npm run -w @ai-cursor/cli build` produces `dist/`.
- Risks
  - TS project references complexity → mitigate with a single root tsconfig baseline.

---

## Phase 2 — Core PTY + Process Orchestration (MVP skeleton)
- Objectives
  - Lay down `Orchestrator`, PTY wrapper, lifecycle and state machine.
- Deliverables
  - `@ai-cursor/core`:
    - `orchestrator/Orchestrator.ts`, `StateMachine.ts`, `Events.ts`.
    - `cursor/CursorProcess.ts` (PTY spawn via `node-pty`), graceful shutdown.
    - `telemetry/Logger.ts` (pino) with JSON logs.
  - `@ai-cursor/cli`:
    - `src/index.ts` with a `run` command that launches orchestrator in dry-run mode.
- Acceptance
  - `ai-cursor run --dry-run` starts and exits cleanly.
- Risks
  - PTY flakiness across OS; keep macOS/Linux in CI matrix later.

---

## Phase 3 — Output Watcher & Detectors (Regex)
- Objectives
  - Classify Cursor output into Running, WaitingForInput, Question, Completed.
- Deliverables
  - `@ai-cursor/core/cursor/CursorDetectors.ts` (configurable regex-based detectors).
  - `@ai-cursor/detectors/src/builtin.ts` with sensible defaults and profiles.
  - Idle debounce (e.g., 600–1200ms) and rolling window buffer.
- Acceptance
  - Unit tests: known stdout snippets → expected classification.
- Risks
  - Over/under-detection; mitigate with profiles and JSON overrides.

---

## Phase 4 — LLM Provider Adapter (OpenAI first)
- Objectives
  - Pluggable provider interface with OpenAI implementation.
- Deliverables
  - `@ai-cursor/core/llm/Provider.ts` interface.
  - `OpenAIProvider.ts` with retries/backoff and token budgeting stub.
  - `MockProvider.ts` for tests.
- Acceptance
  - Integration test: orchestrator calls provider; mock returns answer.
- Risks
  - API limits and latency; include exponential backoff.

---

## Phase 5 — Context Builder & Prompt Templates
- Objectives
  - Build structured prompts from recent output, plan step, and FS snapshot.
- Deliverables
  - `context/ContextBuilder.ts`, `FileSystemProbe.ts`, `History.ts`.
  - `prompts/systemPrompt.ts`, `prompts/userPrompt.ts` per design.
- Acceptance
  - Unit tests verify redactions and prompt composition order.
- Risks
  - Token bloat; add trimming and summarization fallback hooks.

---

## Phase 6 — CLI UX & Config
- Objectives
  - Wire CLI flags and profiles; add `plan.yml` support.
- Deliverables
  - CLI flags per design (`--prompt`, `--plan`, `--cursor`, `--cwd`, `--provider`, `--model`, `--dry-run`, `--max-steps`, `--timeout`, `--log`).
  - `plan.yml` schema parser and executor (sequential steps → Cursor commands).
  - JSON overrides for detectors (`detectors.json`).
- Acceptance
  - `ai-cursor run --prompt ./x.md --plan ./plan.yml --dry-run` prints intended actions.
- Risks
  - CLI ergonomics; provide helpful error messages and examples.

---

## Phase 7 — Answering Loop & Transcript Logging (MVP)
- Objectives
  - Close the loop: detect question → build prompt → query LLM → type answer.
- Deliverables
  - Orchestrator wiring for `ASKING_QUESTION` and `AWAITING_INPUT`.
  - Keystroke injection with CR/LF handling; end-of-line behavior.
  - Transcript JSONL and raw stdout/stderr log files.
- Acceptance
  - End-to-end with a scripted mock Cursor produces correct replies and transcript.
- Risks
  - Multi-line inputs; MVP scopes to y/n and numeric choices.

---

## Phase 8 — Testing Suite (Unit + Integration)
- Objectives
  - Build robust unit and integration tests; golden transcripts.
- Deliverables
  - Unit tests: detectors, context builder, provider adapters.
  - Mock Cursor binary for scripted prompts; E2E tests (dry-run and typing-enabled).
  - Golden transcript snapshots and diffing on PRs.
- Acceptance
  - `npm test` green across packages; coverage thresholds documented.
- Risks
  - PTY timing flakiness; use timeouts and deterministic mock outputs.

---

## Phase 9 — Safety, Guard Rails, and Resilience
- Objectives
  - Add timeouts, step caps, loop breakers, and safe defaults.
- Deliverables
  - `--max-steps`, `--timeout`, loop detection (same Q x3 → escalate).
  - Default to non-destructive choices unless explicitly allowed.
  - Resume mode stub (`--resume manifest.json`).
- Acceptance
  - Integration tests cover timeouts and loop breaker behavior.
- Risks
  - False positives on loop detection; tune thresholds.

---

## Phase 10 — Configuration & Profiles Hardening
- Objectives
  - Versioned detector profiles; JSON overrides; environment loading.
- Deliverables
  - `detectors/builtin.ts` with version tags; merge strategy with user overrides.
  - Config discovery order and validation errors.
- Acceptance
  - Swapping profiles meaningfully changes detection behavior in tests.

---

## Phase 11 — Packaging, DX, and Docs
- Objectives
  - Polish developer experience and documentation.
- Deliverables
  - `README`, quickstart, `plan.yml` example, governing prompt examples.
  - Root scripts: `build`, `typecheck`, `lint`, `test` wired across workspaces.
  - Pre-commit hooks (lint-staged/biome) enforced.
- Acceptance
  - A new developer can clone → install → run a sample plan successfully.

---

## Phase 12 — Extensibility: Providers & Detectors
- Objectives
  - Add additional providers and detector enhancements.
- Deliverables
  - `AnthropicProvider.ts`, provider selection via flags.
  - Detectors enhancers; optional light classifier hook.
- Acceptance
  - Provider swap works via flags and env vars; detectors can be extended.

---

## Phase 13 — Performance & Telemetry
- Objectives
  - Improve throughput, logging, metrics.
- Deliverables
  - Token budgeting utilities; summarized history fallback.
  - Structured logs with run IDs; basic metrics counters.
- Acceptance
  - Large sessions remain within token limits; logs are queryable.

---

## Phase 14 — Optional Web Dashboard (Post-MVP)
- Objectives
  - Live view of transcript and artifacts.
- Deliverables
  - Minimal web app streaming transcript via WebSocket.
- Acceptance
  - Observe a running session live; download artifacts afterward.

---

## Phase Mapping to Design (Quick Index)
- Design §3 Workspace Layout → Phase 1
- Design §5 State Machine → Phase 2, 7
- Design §6 Detectors → Phase 3, 10
- Design §7 Prompting → Phase 5
- Design §8 Provider Adapter → Phase 4, 12
- Design §9 FS Context → Phase 5
- Design §10 Logging → Phase 7, 13
- Design §12 Config → Phase 6, 10
- Design §13–14 PTY/Loop → Phase 2, 7
- Design §16 Testing → Phase 8
- Design §17 Security → Phase 9, 13
- Design §18 Roadmap → Phase 12–14
- Design §21–22 MVP → Phases 2–9

---

## Next Steps
1. Implement Phase 1 skeleton packages and scripts.
2. Land Phase 2 orchestrator + PTY with dry-run.
3. Begin Phase 3 detectors with unit tests.
