import { jsonSchema, tool as sdkTool } from "ai";
import type {
  AssistantModelMessage,
  ModelMessage,
  ToolCallPart,
  ToolModelMessage,
  ToolSet,
  UserModelMessage,
} from "ai";
import type {
  AIMessage,
  AssistantContent,
  AssistantMessage,
  FinishReason,
  StreamEvent,
  ToolDefinition,
  ToolResultMessage,
  TokenUsage,
  UserMessage,
} from "@/ports/ai-provider";
import type { AIError } from "@/shared/errors";

/** Port の AIMessage[] → Vercel AI SDK の ModelMessage[] */
export function toSDKMessages(messages: AIMessage[]): ModelMessage[] {
  return messages
    .filter((msg) => {
      if (msg.role === "assistant" && msg.content.length === 0) return false;
      if (
        msg.role === "assistant" &&
        msg.content.length === 1 &&
        msg.content[0].type === "text" &&
        msg.content[0].text === ""
      )
        return false;
      return true;
    })
    .map((msg): ModelMessage => {
      switch (msg.role) {
        case "user":
          return toUserMessage(msg);
        case "assistant":
          return toAssistantMessage(msg);
        case "tool":
          return toToolMessage(msg);
      }
    });
}

function toUserMessage(msg: UserMessage): UserModelMessage {
  return {
    role: "user",
    content: msg.content.map((c) => {
      if (c.type === "text") return { type: "text" as const, text: c.text };
      if (c.type === "image")
        return {
          type: "image" as const,
          image: c.data,
          mediaType: c.mimeType,
        };
      throw new Error("Unknown user content type");
    }),
  };
}

function toAssistantMessage(msg: AssistantMessage): AssistantModelMessage {
  const content = msg.content.map((c: AssistantContent) => {
    if (c.type === "text") return { type: "text" as const, text: c.text };
    const part: ToolCallPart = {
      type: "tool-call",
      toolCallId: c.id,
      toolName: c.name,
      input: c.args,
    };
    if (c.providerOptions) {
      part.providerOptions = c.providerOptions as ToolCallPart["providerOptions"];
    }
    return part;
  });
  return { role: "assistant", content };
}

function toToolMessage(msg: ToolResultMessage): ToolModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        output: { type: "text", value: msg.result },
      },
    ],
  };
}

/**
 * Port の ToolDefinition[] → Vercel AI SDK の ToolSet
 * jsonSchema() ヘルパーで JSON Schema を直接渡す (Zod変換不要)
 */
export function toSDKTools(tools: ToolDefinition[]): ToolSet {
  const result: ToolSet = {};
  for (const t of tools) {
    result[t.name] = sdkTool({
      description: t.description,
      inputSchema: jsonSchema(t.parameters),
    });
  }
  return result;
}

/**
 * AI SDK v6 の TextStreamPart → Port の StreamEvent に変換。
 * 不要なイベント (text-start, reasoning-delta 等) は null を返す。
 */
export function toStreamEvent(part: Record<string, unknown>): StreamEvent | null {
  switch (part.type) {
    case "text-delta":
      return { type: "text-delta", text: part.text as string };

    case "reasoning-delta":
      return { type: "reasoning-delta", text: part.text as string };

    case "tool-call": {
      const providerMeta = part.providerMetadata as
        | Record<string, Record<string, unknown>>
        | undefined;
      return {
        type: "tool-call",
        id: part.toolCallId as string,
        name: part.toolName as string,
        args: part.input as Record<string, unknown>,
        ...(providerMeta ? { providerOptions: providerMeta } : {}),
      };
    }

    case "tool-input-start": {
      const inputProviderMeta = part.providerMetadata as
        | Record<string, Record<string, unknown>>
        | undefined;
      return {
        type: "tool-input-start",
        id: part.id as string,
        name: part.toolName as string,
        ...(inputProviderMeta ? { providerOptions: inputProviderMeta } : {}),
      };
    }

    case "tool-input-delta":
      return {
        type: "tool-input-delta",
        id: part.id as string,
        delta: part.delta as string,
      };

    case "tool-result":
      return {
        type: "tool-result",
        id: part.toolCallId as string,
        name: part.toolName as string,
        result: part.output,
      };

    case "tool-error":
      return {
        type: "tool-result",
        id: part.toolCallId as string,
        name: part.toolName as string,
        result: `Error: ${part.error instanceof Error ? part.error.message : String(part.error)}`,
      };

    case "finish": {
      const usage = extractTokenUsage(part);
      return {
        type: "finish",
        finishReason: mapFinishReason(part.finishReason),
        usage,
      };
    }

    case "error":
      return { type: "error", error: toAIError(part.error) };

    default:
      return null;
  }
}

/**
 * トークン使用量を抽出する（プロバイダー間の命名差異に対応）
 */
function extractTokenUsage(part: Record<string, unknown>): TokenUsage | undefined {
  const totalUsage = part.totalUsage as Record<string, unknown> | undefined;
  if (!totalUsage) return undefined;

  const inputTokenDetails = totalUsage.inputTokenDetails as Record<string, unknown> | undefined;
  const outputTokenDetails = totalUsage.outputTokenDetails as Record<string, unknown> | undefined;

  // 様々な命名規則に対応
  const promptTokens =
    (totalUsage.promptTokens as number | undefined) ??
    (totalUsage.prompt_tokens as number | undefined) ??
    (totalUsage.inputTokens as number | undefined) ??
    (totalUsage.input_tokens as number | undefined) ??
    0;

  const completionTokens =
    (totalUsage.completionTokens as number | undefined) ??
    (totalUsage.completion_tokens as number | undefined) ??
    (totalUsage.outputTokens as number | undefined) ??
    (totalUsage.output_tokens as number | undefined) ??
    0;

  const reasoningTokens =
    (outputTokenDetails?.reasoningTokens as number | undefined) ??
    (totalUsage.reasoningTokens as number | undefined);

  const normalizedInputTokenDetails = compactTokenDetails(
    inputTokenDetails
      ? {
          noCacheTokens:
            (inputTokenDetails.noCacheTokens as number | undefined) ??
            (inputTokenDetails.no_cache_tokens as number | undefined),
          cacheReadTokens:
            (inputTokenDetails.cacheReadTokens as number | undefined) ??
            (inputTokenDetails.cache_read_tokens as number | undefined),
          cacheWriteTokens:
            (inputTokenDetails.cacheWriteTokens as number | undefined) ??
            (inputTokenDetails.cache_write_tokens as number | undefined),
        }
      : undefined,
  );

  const normalizedOutputTokenDetails = compactTokenDetails(
    outputTokenDetails
      ? {
          textTokens:
            (outputTokenDetails.textTokens as number | undefined) ??
            (outputTokenDetails.text_tokens as number | undefined),
          reasoningTokens,
        }
      : undefined,
  );

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    ...(normalizedInputTokenDetails?.cacheReadTokens !== undefined
      ? { cachedInputTokens: normalizedInputTokenDetails.cacheReadTokens }
      : {}),
    ...(normalizedInputTokenDetails ? { inputTokenDetails: normalizedInputTokenDetails } : {}),
    ...(normalizedOutputTokenDetails ? { outputTokenDetails: normalizedOutputTokenDetails } : {}),
  };
}

function compactTokenDetails<T extends Record<string, number | undefined>>(
  details: T | undefined,
): T | undefined {
  if (!details) return undefined;
  const compacted = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  ) as T;
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function mapFinishReason(reason: unknown): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool-calls":
      return "tool-calls";
    case "length":
      return "length";
    case "error":
      return "error";
    default:
      return "other";
  }
}

/** SDK/API エラーを AIError に変換 */
export function toAIError(error: unknown): AIError {
  const statusCode = (error as { statusCode?: number }).statusCode;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (statusCode === 413 || msg.includes("too large") || msg.includes("payload too large"))
    return {
      code: "ai_payload_too_large",
      message: "送信データが大きすぎます。画像サイズを小さくして再試行してください。",
      cause: error,
    };

  if (statusCode === 429 || msg.includes("rate limit"))
    return {
      code: "ai_rate_limit",
      message: "APIのレート制限に達しました。しばらく待ってから再試行してください。",
      cause: error,
    };

  if (statusCode === 401 || msg.includes("unauthorized") || msg.includes("invalid api key"))
    return {
      code: "ai_auth_invalid",
      message: "認証エラー (401)。トークンが期限切れの可能性があります。",
      cause: error,
    };

  if (
    msg.includes("model") &&
    (msg.includes("not found") || msg.includes("not supported") || msg.includes("not accessible"))
  )
    return {
      code: "ai_model_not_found",
      message: "指定されたモデルが見つかりません。",
      cause: error,
    };

  if (statusCode != null && statusCode >= 400)
    return {
      code: "ai_unknown",
      message: `AI APIエラー (${statusCode}): ${error instanceof Error ? error.message : String(error)}`,
      cause: error,
    };

  if (msg.includes("fetch") || msg.includes("network") || msg.includes("econnrefused"))
    return {
      code: "ai_network",
      message: "AIサービスに接続できません。ネットワーク接続を確認してください。",
      cause: error,
    };

  return {
    code: "ai_unknown",
    message: `AI APIエラー: ${String(error)}`,
    cause: error,
  };
}
