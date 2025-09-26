/** Render a user prompt combining governing prompt, output, and optional hints. */
export function renderUserPrompt(input: {
  governingPrompt: string | undefined;
  recentOutput: string;
  planContext?: string;
  fsChangedFiles?: string[];
  questionHint?: string;
  answerFormatHint?: string;
}): string {
  const parts: string[] = [];
  if (input.governingPrompt) parts.push(`Governing Prompt:\n${input.governingPrompt}`);
  if (input.planContext) parts.push(`Plan Context:\n${input.planContext}`);
  parts.push(`Recent Output:\n${truncate(input.recentOutput, 800)}`);
  if (input.fsChangedFiles && input.fsChangedFiles.length > 0) {
    parts.push(`Changed Files:\n${input.fsChangedFiles.slice(-10).join('\n')}`);
  }
  if (input.questionHint) parts.push(`Question:\n${input.questionHint}`);
  if (input.answerFormatHint) parts.push(`Answer Format:\n${input.answerFormatHint}`);
  return parts.join('\n\n');
}

/** Truncate trailing content to a maximum length, preserving the end. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(-maxLen);
}
