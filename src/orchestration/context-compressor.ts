import type { AIMessage, AIProvider, UserMessage } from "@/ports/ai-provider";
import type { Session, ConversationSummary } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { ProviderId } from "@/shared/constants";
import { createLogger } from "@/shared/logger";
import { estimateTokens } from "@/shared/token-utils";
import {
  buildStructuredSummaryPromptInput,
  STRUCTURED_SUMMARY_SYSTEM_PROMPT,
} from "@/features/ai/structured-summary-prompt";

export { estimateTokens } from "@/shared/token-utils";

const KEEP_RECENT = 10;
const log = createLogger("compressor");
export const STRUCTURED_SUMMARY_MESSAGE_PREFIX = "[構造化要約]";

export interface CompressResult {
  session: Session;
  compressed: boolean;
}

export interface CompressMessagesResult {
  messages: AIMessage[];
  summary?: ConversationSummary;
  compressed: boolean;
}

/**
 * セッションのトークン数が閾値を超えている場合に圧縮を試みる。
 *
 * - ローカルLLM: 自動で圧縮を実行
 * - クラウドプロバイダー: options.userConfirmed が true の場合のみ実行
 * - 圧縮失敗時: 元のセッションをそのまま返す (データ損失なし)
 */
export async function compressIfNeeded(
  aiProvider: AIProvider,
  session: Session,
  budget: ContextBudget,
  model: string,
  provider: ProviderId,
  options: { userConfirmed?: boolean } = {},
): Promise<CompressResult> {
  const result = await compressMessagesIfNeeded(
    aiProvider,
    session.history,
    budget,
    model,
    provider,
    {
      userConfirmed: options.userConfirmed,
      existingSummary: session.summary?.text,
      originalMessageCount: session.summary?.originalMessageCount,
    },
  );

  if (!result.compressed || !result.summary) {
    return { session, compressed: false };
  }

  return {
    session: {
      ...session,
      summary: result.summary,
      history: result.messages.slice(1),
    },
    compressed: true,
  };
}

export async function compressMessagesIfNeeded(
  aiProvider: AIProvider,
  messages: AIMessage[],
  budget: ContextBudget,
  model: string,
  provider: ProviderId,
  options: {
    userConfirmed?: boolean;
    existingSummary?: string;
    originalMessageCount?: number;
  } = {},
): Promise<CompressMessagesResult> {
  const tokenCount = estimateTokens(messages);
  if (tokenCount < budget.trimThreshold) {
    return { messages, compressed: false };
  }

  log.info("コンテキスト圧縮開始", {
    tokenCount,
    trimThreshold: budget.trimThreshold,
    provider,
  });

  if (provider !== "local" && provider !== "ollama" && !options.userConfirmed) {
    return { messages, compressed: false };
  }

  const currentSummary = options.existingSummary ?? extractStructuredSummary(messages)?.text;
  const sourceMessages = stripStructuredSummaryMessages(messages);
  const toCompress = sourceMessages.slice(0, -KEEP_RECENT);
  const toKeep = sourceMessages.slice(-KEEP_RECENT);

  if (toCompress.length === 0) {
    return { messages, compressed: false };
  }

  try {
    const summaryText = await summarizeMessages(aiProvider, model, currentSummary, toCompress);
    const summary: ConversationSummary = {
      text: summaryText,
      compressedAt: Date.now(),
      originalMessageCount: (options.originalMessageCount ?? 0) + toCompress.length,
    };
    const summaryMessage = createStructuredSummaryMessage(summary.text);

    log.info("コンテキスト圧縮完了", {
      compressedCount: toCompress.length,
      keptCount: toKeep.length,
    });

    return {
      messages: [summaryMessage, ...toKeep],
      summary,
      compressed: true,
    };
  } catch (e) {
    log.error("コンテキスト圧縮失敗", e);
    return { messages, compressed: false };
  }
}

export function stripStructuredSummaryMessages(messages: AIMessage[]): AIMessage[] {
  return messages.filter(
    (message, index) => !(index === 0 && stripStructuredSummaryMessage(message)),
  );
}

export function stripStructuredSummaryMessage(message: AIMessage | undefined): string | undefined {
  const text = getSingleTextContent(message);
  if (!text?.startsWith(`${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n`)) {
    return undefined;
  }
  return text.slice(`${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n`.length);
}

async function summarizeMessages(
  aiProvider: AIProvider,
  model: string,
  existingSummary: string | undefined,
  messages: AIMessage[],
): Promise<string> {
  const userMessage: UserMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: buildStructuredSummaryPromptInput({ existingSummary, messages }),
      },
    ],
  };

  let result = "";
  const stream = aiProvider.streamText({
    model,
    systemPrompt: STRUCTURED_SUMMARY_SYSTEM_PROMPT,
    messages: [userMessage],
    tools: [],
  });

  for await (const event of stream) {
    if (event.type === "text-delta") {
      result += event.text;
    }
    if (event.type === "error") {
      throw new Error(event.error.message);
    }
  }

  return result.trim();
}

function createStructuredSummaryMessage(summaryText: string): UserMessage {
  return {
    role: "user",
    content: [{ type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n${summaryText}` }],
  };
}

function extractStructuredSummary(messages: AIMessage[]): ConversationSummary | undefined {
  const text = stripStructuredSummaryMessage(messages[0]);
  if (!text) return undefined;
  return {
    text,
    compressedAt: Date.now(),
    originalMessageCount: 0,
  };
}

function getSingleTextContent(message: AIMessage | undefined): string | undefined {
  if (!message || message.role !== "user") return undefined;
  if (message.content.length !== 1) return undefined;
  const [part] = message.content;
  return part.type === "text" ? part.text : undefined;
}
