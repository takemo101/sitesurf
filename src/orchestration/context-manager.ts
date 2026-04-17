import type { AIMessage, AIProvider } from "@/ports/ai-provider";
import type { ConversationSummary } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { ProviderId } from "@/shared/constants";

import {
  compressMessagesIfNeeded,
  estimateTokens,
  stripStructuredSummaryMessage,
} from "./context-compressor";

export interface ContextManagerResult {
  messages: AIMessage[];
  summary?: ConversationSummary;
  compressed: boolean;
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
  const truncatedMessages = truncateToolResults(input.messages, input.budget);

  if (estimateTokens(truncatedMessages) < input.budget.trimThreshold) {
    return {
      messages: truncatedMessages,
      summary: input.sessionSummary,
      compressed: false,
    };
  }

  const compressionResult = await compressMessagesIfNeeded(
    input.aiProvider,
    truncatedMessages,
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
    messages: trimMessagesToThreshold(truncatedMessages, input.budget.trimThreshold),
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

function truncateToolResults(messages: AIMessage[], budget: ContextBudget): AIMessage[] {
  return messages.map((message) => {
    if (message.role !== "tool") return message;

    if (message.result.includes("data:image/")) {
      return { ...message, result: "[screenshot captured]" };
    }

    if (message.result.length <= budget.maxToolResultChars) {
      return message;
    }

    return {
      ...message,
      result: `${message.result.substring(0, budget.maxToolResultChars)}\n... (truncated)`,
    };
  });
}
