import type { AIMessage, TokenUsage, ToolDefinition } from "@/ports/ai-provider";
import { lookupModelContextWindow } from "@/shared/model-utils";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";
import { createLogger, logStructuredInfo } from "@/shared/logger";
import { estimateTokens } from "@/shared/token-utils";

const log = createLogger("context-budget");
const CONTEXT_BUDGET_LOG_PREFIX = "[ctx-budget]";
const APPROX_CHARS_PER_TOKEN = 4;

function toApproxTokens(charCount: number): number {
  return Math.ceil(charCount / APPROX_CHARS_PER_TOKEN);
}

function estimateTextTokens(text: string): number {
  return toApproxTokens(text.length);
}

function estimateSerializedTokens(value: unknown): number {
  return estimateTextTokens(JSON.stringify(value));
}

function estimateMessageTokens(messages: AIMessage[]): number {
  return toApproxTokens(estimateTokens(messages));
}

export interface ContextBudget {
  windowTokens: number;
  outputReserve: number;
  inputBudget: number;
  maxToolResultChars: number;
  compressionThreshold: number;
  trimThreshold: number;
  systemPromptTokens: number;
  toolsTokens: number;
  historyTokens: number;
  toolResultsTokens: number;
}

export function getContextBudget(model: string, settingsMaxTokens?: number): ContextBudget {
  const windowTokens = lookupModelContextWindow(model);
  const requestedOutput = settingsMaxTokens ?? DEFAULT_MAX_TOKENS;
  const outputReserve = Math.min(requestedOutput, Math.floor(windowTokens * 0.5));

  if (requestedOutput > outputReserve) {
    log.info("maxTokens clamped", {
      requested: requestedOutput,
      effective: outputReserve,
      windowTokens,
    });
  }

  const inputBudget = windowTokens - outputReserve;

  return {
    windowTokens,
    outputReserve,
    inputBudget,
    maxToolResultChars:
      inputBudget >= 150_000
        ? 20_000
        : inputBudget >= 80_000
          ? 10_000
          : inputBudget >= 40_000
            ? 4_000
            : inputBudget >= 20_000
              ? 2_000
              : 1_000,
    compressionThreshold: Math.floor(inputBudget * 0.6),
    trimThreshold: Math.floor(inputBudget * 0.85),
    systemPromptTokens: 0,
    toolsTokens: 0,
    historyTokens: 0,
    toolResultsTokens: 0,
  };
}

export function buildContextBudgetBreakdown(input: {
  systemPrompt: string;
  tools: ToolDefinition[];
  messages: AIMessage[];
  latestToolResultIds?: ReadonlySet<string>;
}): Pick<
  ContextBudget,
  "systemPromptTokens" | "toolsTokens" | "historyTokens" | "toolResultsTokens"
> {
  const latestToolResultIds = input.latestToolResultIds ?? new Set<string>();
  const historyMessages: AIMessage[] = [];
  const latestToolResultMessages: AIMessage[] = [];

  for (const message of input.messages) {
    if (message.role === "tool" && latestToolResultIds.has(message.toolCallId)) {
      latestToolResultMessages.push(message);
      continue;
    }
    historyMessages.push(message);
  }

  return {
    systemPromptTokens: estimateTextTokens(input.systemPrompt),
    toolsTokens: estimateSerializedTokens(input.tools),
    historyTokens: estimateMessageTokens(historyMessages),
    toolResultsTokens: estimateMessageTokens(latestToolResultMessages),
  };
}

export function logContextBudgetSnapshot(input: {
  phase: "request" | "finish";
  model: string;
  turn: number;
  budget: ContextBudget;
  usage?: TokenUsage;
}): void {
  const promptCacheReadTokens =
    input.usage?.inputTokenDetails?.cacheReadTokens ?? input.usage?.cachedInputTokens;
  const promptCacheWriteTokens = input.usage?.inputTokenDetails?.cacheWriteTokens;
  const reasoningTokens =
    input.usage?.outputTokenDetails?.reasoningTokens ?? input.usage?.reasoningTokens;
  const promptCacheHitRate =
    input.usage && input.usage.promptTokens > 0 && promptCacheReadTokens !== undefined
      ? promptCacheReadTokens / input.usage.promptTokens
      : undefined;

  logStructuredInfo(CONTEXT_BUDGET_LOG_PREFIX, {
    phase: input.phase,
    model: input.model,
    turn: input.turn,
    windowTokens: input.budget.windowTokens,
    inputBudget: input.budget.inputBudget,
    outputReserve: input.budget.outputReserve,
    systemPromptTokens: input.budget.systemPromptTokens,
    toolsTokens: input.budget.toolsTokens,
    historyTokens: input.budget.historyTokens,
    toolResultsTokens: input.budget.toolResultsTokens,
    reasoningTokens,
    promptTokens: input.usage?.promptTokens,
    completionTokens: input.usage?.completionTokens,
    totalTokens: input.usage?.totalTokens,
    promptCacheReadTokens,
    promptCacheWriteTokens,
    promptCacheHitRate,
  });
}
