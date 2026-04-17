// Stage 2 truncation for LLM compression prompts.
// Stage 1 truncation (maxToolResultChars) runs at tool execution time via context-budget.
// For small context windows where maxToolResultChars <= 2000, this is a no-op.
export const TOOL_RESULT_SUMMARY_MAX_CHARS = 2000;

export function truncateForSummary(text: string): string {
  if (text.length <= TOOL_RESULT_SUMMARY_MAX_CHARS) return text;
  return text.substring(0, TOOL_RESULT_SUMMARY_MAX_CHARS) + "\n... (truncated for summarization)";
}
