import type { AIMessage, AIProvider } from "@/ports/ai-provider";
import type { ConversationSummary } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { ProviderId } from "@/shared/constants";
import { createLogger } from "@/shared/logger";
import { estimateTokens } from "@/shared/token-utils";
import { restoreRetrievedToolResultToSummary } from "@/features/tools/result-summarizer";

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
      log.info("[diag:get_tool_result] expiring retrieved content → summary form", {
        index,
        beforeChars: message.result.length,
        afterChars: restored.length,
        reason: "laterNonToolMessageExists",
      });
      message.result = restored;
    } else {
      log.info("[diag:get_tool_result] preserving active retrieved content", {
        index,
        chars: message.result.length,
      });
    }
  }
}

const ACTIVE_RETRIEVED_RESULT_PREFIX = "[get_tool_result]\nRestored:";

function normalizeContextMessages(messages: AIMessage[], budget: ContextBudget): void {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message.role !== "tool" || typeof message.result !== "string") {
      continue;
    }

    // 復元中の get_tool_result は maxToolResultChars で切り詰めない。
    // AI が明示的に全文を求めた直後の 1 ターン限定で渡す想定で、
    // 次ターン以降は replaceExpiredRetrievedResults が要約形へ戻す。
    if (message.result.startsWith(ACTIVE_RETRIEVED_RESULT_PREFIX)) {
      log.info("[diag:get_tool_result] bypass truncate (active)", {
        index,
        chars: message.result.length,
        maxToolResultChars: budget.maxToolResultChars,
      });
      continue;
    }

    const before = message.result.length;
    const truncated = truncateToolResult(message.result, budget.maxToolResultChars);
    if (before !== truncated.length) {
      log.info("[diag:tool_result_truncate] applied", {
        index,
        toolName: message.toolName,
        beforeChars: before,
        afterChars: truncated.length,
        maxToolResultChars: budget.maxToolResultChars,
      });
    }
    messages[index] = { ...message, result: truncated };
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
