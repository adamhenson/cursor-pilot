/** Default regex patterns for classifying Cursor output. */
export const defaultDetectorPatterns = {
  question: [
    /\?\s*$/m,
    /^Confirm (yes\/no):/i,
    /^(Proceed|Continue)\? \[y\/n\]/i,
    /Run this command\?/i,
    /Not in allowlist:/i,
  ],
  awaitingInput: [/^Enter .*:/i, /^Provide .*:/i],
  completion: [/^All tasks (completed|done)\.?$/i, /^✅ (Build|Refactor|Scaffold) complete/i],
};

/** Union of detector categories. */
export type DetectorCategory = keyof typeof defaultDetectorPatterns;
