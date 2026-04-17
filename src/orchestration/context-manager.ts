import type { AIMessage } from "@/ports/ai-provider";
import type { ContextBudget } from "@/features/ai/context-budget";
import { estimateTokens } from "@/shared/token-utils";
import { restoreRetrievedToolResultToSummary } from "@/features/tools/result-summarizer";

function truncateToolResult(result: string, maxChars: number): string {
  if (result.includes("data:image/")) {
    return "[screenshot captured]";
  }
  if (result.length <= maxChars) {
    return result;
  }
  return `${result.slice(0, maxChars)}\n... (truncated)`;
}

function replaceExpiredRetrievedResults(messages: AIMessage[]): void {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role !== "tool" || typeof message.result !== "string") {
      continue;
    }

    const restored = restoreRetrievedToolResultToSummary(message.result);
    if (!restored) {
      continue;
    }

    const hasLaterMessage = messages
      .slice(index + 1)
      .some((candidate) => candidate.role !== "tool");
    if (hasLaterMessage) {
      message.result = restored;
    }
  }
}

export function manageContextMessages(messages: AIMessage[], budget: ContextBudget): void {
  for (const message of messages) {
    if (message.role === "tool" && typeof message.result === "string") {
      message.result = truncateToolResult(message.result, budget.maxToolResultChars);
    }
  }

  replaceExpiredRetrievedResults(messages);

  while (messages.length > 4 && estimateTokens(messages) > budget.trimThreshold) {
    const oldest = messages.findIndex(
      (message, index) => index > 0 && (message.role === "tool" || message.role === "assistant"),
    );
    if (oldest <= 0) {
      break;
    }
    messages.splice(oldest, 1);
  }
}
