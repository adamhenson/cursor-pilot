# Environment Variables

These variables can be set in your shell or loaded via a local `.env` file.

- `CURSORPILOT_PROVIDER` (default: `mock`): Provider name (`mock` or `openai`).
- `CURSORPILOT_MODEL` (optional): Provider model id.
- `CURSORPILOT_LOG_DIR` (optional): Default transcript log directory.
- `CURSORPILOT_TIMEOUT_MS` (optional): Max run time in milliseconds.
- `CURSORPILOT_MAX_STEPS` (optional): Max number of answers to type before stopping.
- `CURSORPILOT_LOOP_BREAKER` (optional): Stop if the same Q/A repeats this many times.
- `CURSORPILOT_IDLE_MS` (default: `5000`): Idle threshold (ms) to infer what to type when no prompt is detected.
- `CURSORPILOT_AUTO_ANSWER_IDLE` (optional): If truthy, auto-type safe answers (y/n or numeric) on idle.
- `CURSORPILOT_CURSOR_CMD_TIMEOUT_MS` (default: `20000`): Timeout for each cursor-agent command (ms).
- `CURSORPILOT_DETECTORS` (optional): Path to detectors JSON overrides.
- `CURSORPILOT_VERBOSE_EVENTS` (optional): If truthy, print event types to stdout.
- `ECHO_ANSWERS` (optional): If truthy, echo typed answers to stdout.
- `OPENAI_API_KEY` (required if provider is `openai`): API key for OpenAI.

Example `.env`:
```env
CURSORPILOT_PROVIDER=mock
CURSORPILOT_MODEL=
CURSORPILOT_LOG_DIR=./runs/sample-01
CURSORPILOT_TIMEOUT_MS=3600000
CURSORPILOT_MAX_STEPS=1000
CURSORPILOT_LOOP_BREAKER=2
CURSORPILOT_IDLE_MS=3000
CURSORPILOT_AUTO_ANSWER_IDLE=true
CURSORPILOT_CURSOR_CMD_TIMEOUT_MS=20000
CURSORPILOT_DETECTORS=./detectors.json
CURSORPILOT_VERBOSE_EVENTS=true
ECHO_ANSWERS=true
OPENAI_API_KEY=
```
