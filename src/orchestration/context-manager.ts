import type { AIMessage, AIProvider } from "@/ports/ai-provider";
import type { ConversationSummary } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { ProviderId } from "@/shared/constants";
import { createLogger } from "@/shared/logger";
import { estimateTokens } from "@/shared/token-utils";

import { compressMessagesIfNeeded, stripStructuredSummaryMessage } from "./context-compressor";

const log = createLogger("context-manager");

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

function normalizeContextMessages(messages: AIMessage[], budget: ContextBudget): void {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message.role !== "tool" || typeof message.result !== "string") {
      continue;
    }
    const next = truncateToolResult(message.result, budget.maxToolResultChars);
    if (next !== message.result) {
      messages[index] = { ...message, result: next };
    }
  }
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
  const estimatedTokens = estimateTokens(normalizedMessages);

  if (estimatedTokens < input.budget.trimThreshold) {
    return {
      messages: normalizedMessages,
      summary: input.sessionSummary,
      compressed: false,
    };
  }

  log.info("trimThreshold reached", {
    estimatedTokens,
    trimThreshold: input.budget.trimThreshold,
    messagesCount: normalizedMessages.length,
  });

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
  const initialEstimatedTokens = estimateTokens(nextMessages);

  if (initialEstimatedTokens > threshold) {
    log.info("trimThreshold reached", {
      estimatedTokens: initialEstimatedTokens,
      trimThreshold: threshold,
      messagesCount: nextMessages.length,
    });
  }

  let splicedMessageCount = 0;

  while (nextMessages.length > 4 && estimateTokens(nextMessages) > threshold) {
    const oldest = nextMessages.findIndex(
      (message, index) => index > 0 && (message.role === "tool" || message.role === "assistant"),
    );
    if (oldest > 0) {
      nextMessages.splice(oldest, 1);
      splicedMessageCount += 1;
      continue;
    }

    if (nextMessages[0] && stripStructuredSummaryMessage(nextMessages[0])) {
      nextMessages.shift();
      splicedMessageCount += 1;
      continue;
    }

    break;
  }

  if (splicedMessageCount > 0) {
    log.info("splicedMessageCount", {
      splicedMessageCount,
      remainingMessagesCount: nextMessages.length,
      estimatedTokens: estimateTokens(nextMessages),
      trimThreshold: threshold,
    });
  }

  return nextMessages;
}
