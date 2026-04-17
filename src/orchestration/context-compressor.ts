import type { AIMessage, AIProvider, UserMessage } from "@/ports/ai-provider";
import type { Session, ConversationSummary } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { ProviderId } from "@/shared/constants";
import { createLogger } from "@/shared/logger";
import { estimateTokens } from "@/shared/token-utils";

export { estimateTokens } from "@/shared/token-utils";

const KEEP_RECENT = 10;
const log = createLogger("compressor");

const SUMMARIZE_SYSTEM_PROMPT = [
  "あなたは会話要約の専門家です。",
  "以下の会話履歴を簡潔に要約してください。",
  "重要な情報（ユーザーの意図、AIの回答のポイント、ツール実行の結果）を漏らさず含めてください。",
  "要約は日本語で、箇条書きではなく自然な文章で記述してください。",
].join("\n");

export interface CompressResult {
  session: Session;
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
  const tokenCount = estimateTokens(session.history);
  if (tokenCount < budget.trimThreshold) return { session, compressed: false };

  log.info("コンテキスト圧縮開始", {
    tokenCount,
    trimThreshold: budget.trimThreshold,
    provider,
  });

  if (provider !== "local" && provider !== "ollama" && !options.userConfirmed) {
    return { session, compressed: false };
  }

  const toCompress = session.history.slice(0, -KEEP_RECENT);
  const toKeep = session.history.slice(-KEEP_RECENT);

  if (toCompress.length === 0) return { session, compressed: false };

  try {
    const summaryText = await summarizeMessages(aiProvider, model, session.summary, toCompress);
    log.info("コンテキスト圧縮完了", {
      compressedCount: toCompress.length,
      keptCount: toKeep.length,
    });
    const summary: ConversationSummary = {
      text: summaryText,
      compressedAt: Date.now(),
      originalMessageCount: (session.summary?.originalMessageCount ?? 0) + toCompress.length,
    };
    return {
      session: {
        ...session,
        summary,
        history: toKeep,
      },
      compressed: true,
    };
  } catch (e) {
    log.error("コンテキスト圧縮失敗", e);
    return { session, compressed: false };
  }
}

async function summarizeMessages(
  aiProvider: AIProvider,
  model: string,
  existingSummary: ConversationSummary | undefined,
  messages: AIMessage[],
): Promise<string> {
  const parts: string[] = [];

  if (existingSummary) {
    parts.push(`[既存の要約]\n${existingSummary.text}\n`);
  }

  parts.push("[要約対象の会話履歴]");
  for (const msg of messages) {
    const role =
      msg.role === "user" ? "ユーザー" : msg.role === "assistant" ? "アシスタント" : "ツール";
    if ("content" in msg && Array.isArray(msg.content)) {
      const texts = msg.content.filter(
        (c): c is { type: "text"; text: string } => "text" in c && c.text !== undefined,
      );
      if (texts.length > 0) {
        parts.push(`${role}: ${texts.map((t) => t.text).join(" ")}`);
      }
    }
    if (msg.role === "tool") {
      parts.push(`${role} (${msg.toolName}): ${msg.result}`);
    }
  }

  const userMessage: UserMessage = {
    role: "user",
    content: [{ type: "text", text: parts.join("\n") }],
  };

  let result = "";
  const stream = aiProvider.streamText({
    model,
    systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
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

  return result;
}
