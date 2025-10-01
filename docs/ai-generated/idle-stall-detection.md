### Stall-as-idle detection (Cursor CLI repeating status)

Updated: 2025-10-01

This project now treats repeated, essentially-identical output from Cursor CLI as a stall and emits an `idle` event so the orchestrator can consult the LLM and optionally type a response.

#### How it works

- The detectors track a normalized signature of the most recent "meaningful" output.
- The meaningful timestamp only updates when that signature changes.
- Normalization reduces superficial variation: lowercases, strips digits (timestamps/counters), collapses repeated punctuation/spinner glyphs, and squashes whitespace.
- If the signature does not change for longer than `idleMs`, an `idle` event is emitted. On the second consecutive `idle`, the orchestrator builds context and calls the LLM.
- If `--auto-answer-idle` is set, the agent will type the LLM suggestion back into Cursor.

#### Configuration

- `--idle-ms <num>` or `CURSORPILOT_IDLE_MS=<ms>`: idle threshold in milliseconds (detector-level). Default: 5000.
- `--auto-answer-idle`: when present, type the LLM suggestion on idle; otherwise only think/log.
- `--print-config`: verify effective values at startup.
- Optional guards still apply: `--loop-breaker <n>`, `--max-steps <n>`.
- Optional `--detectors <path>`: provide pattern overrides when you want to classify specific non-questions as `awaitingInput` or `question` immediately.

#### Example run

```bash
npm run dev -- run \
  --cwd "../zet" \
  --prompt "../zet/cursor-pilot/2025-10-01-governing-prompt-fix-tests.md" \
  --plan "../zet/cursor-pilot/plan-tests.yml" \
  --idle-ms 1000 \
  --auto-answer-idle \
  --loop-breaker 3 \
  --max-steps 20 \
  --print-config
```

If `tsx` is not installed, build and run the compiled CLI instead:

```bash
npm -w @cursor-pilot/cli run build && node packages/cli/dist/index.js run \
  --cwd "../zet" \
  --prompt "../zet/cursor-pilot/2025-10-01-governing-prompt-fix-tests.md" \
  --plan "../zet/cursor-pilot/plan-tests.yml" \
  --idle-ms 1000 \
  --auto-answer-idle \
  --loop-breaker 3 \
  --max-steps 20 \
  --print-config
```

#### Tuning and overrides

If the stream keeps changing slightly (e.g., rotating phrases) and you want to force an LLM call sooner, add a detectors override to classify those lines as `awaitingInput`:

```json
{
  "awaitingInput": [
    "^(Let me|Actually, let me|Now I('|’)ll|I('|")m going to|What should I do next)"
  ]
}
```

Run with `--detectors ./detectors.json`.

#### Limitations

- Aggressive normalization may consider progress counters “unchanged.” If that’s a problem, raise `--idle-ms` or reduce normalization in code.
- If the text content genuinely changes (new words), it won’t be treated as idle; use pattern overrides to reclassify.



