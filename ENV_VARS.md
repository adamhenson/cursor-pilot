# Environment Variables

These variables can be set in your shell or loaded via a local `.env` file.

- `CURSORPILOT_PROVIDER` (default: `mock`): Provider name (`mock` or `openai`).
- `CURSORPILOT_MODEL` (optional): Provider model id.
- `CURSORPILOT_LOG_DIR` (optional): Default transcript log directory.
- `OPENAI_API_KEY` (required if provider is `openai`): API key for OpenAI.

Example `.env`:
```env
CURSORPILOT_PROVIDER=mock
CURSORPILOT_MODEL=
CURSORPILOT_LOG_DIR=./runs/sample-01
OPENAI_API_KEY=
```
