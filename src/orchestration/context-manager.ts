import type { AIMessage, AIProvider } from "@/ports/ai-provider";
import type { ConversationSummary } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { ProviderId } from "@/shared/constants";
import { estimateTokens } from "@/shared/token-utils";
import { restoreRetrievedToolResultToSummary } from "@/features/tools/result-summarizer";

import {
  compressMessagesIfNeeded,
  stripStructuredSummaryMessage,
} from "./context-compressor";

export interface ContextManagerResult {
  messages: AIMessage[];
  summary?: ConversationSummary;
  compressed: boolean;
}

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

    const hasLaterMessage = messages.slice(index + 1).some((candidate) => candidate.role !== "tool");
    if (hasLaterMessage) {
      message.result = restored;
    }
  }
}

function normalizeContextMessages(messages: AIMessage[], budget: ContextBudget): void {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message.role !== "tool" || typeof message.result !== "string") {
      continue;
    }

    messages[index] = {
      ...message,
      result: truncateToolResult(message.result, budget.maxToolResultChars),
    };
  }

  replaceExpiredRetrievedResults(messages);
}

export function manageContextMessages(messages: AIMessage[], budget: ContextBudget): void {
  normalizeContextMessages(messages, budget);

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

export async function prepareMessagesForTurn(input: {
  aiProvider: AIProvider;
  messages: AIMessage[];
  budget: ContextBudget;
  model: string;
  provider: ProviderId;
  autoCompact?: boolean;
  sessionSummary?: ConversationSummary;
}): Promise<ContextManagerResult> {
  const normalizedMessages = input.messages.map((message) =>
    message.role === "tool" ? { ...message } : message,
  );
  normalizeContextMessages(normalizedMessages, input.budget);

  if (estimateTokens(normalizedMessages) < input.budget.trimThreshold) {
    return {
      messages: normalizedMessages,
      summary: input.sessionSummary,
      compressed: false,
    };
  }

  const compressionResult = await compressMessagesIfNeeded(
    input.aiProvider,
    normalizedMessages,
    input.budget,
    input.model,
    input.provider,
    {
      userConfirmed: input.autoCompact,
      existingSummary: input.sessionSummary?.text,
      originalMessageCount: input.sessionSummary?.originalMessageCount,
    },
  );

  if (compressionResult.compressed) {
    return compressionResult;
  }

  return {
    messages: trimMessagesToThreshold(normalizedMessages, input.budget.trimThreshold),
    summary: input.sessionSummary,
    compressed: false,
  };
}

export function trimMessagesToThreshold(messages: AIMessage[], threshold: number): AIMessage[] {
  const nextMessages = [...messages];
  while (nextMessages.length > 4 && estimateTokens(nextMessages) > threshold) {
    const oldest = nextMessages.findIndex(
      (message, index) => index > 0 && (message.role === "tool" || message.role === "assistant"),
    );
    if (oldest > 0) {
      nextMessages.splice(oldest, 1);
      continue;
    }

    if (nextMessages[0] && stripStructuredSummaryMessage(nextMessages[0])) {
      nextMessages.shift();
      continue;
    }

    break;
  }

  return nextMessages;
}
