import type { AppError } from "@/shared/errors";
import type { ProviderId } from "@/shared/constants";

// ============= Core Interface =============

export interface AIProvider {
  streamText(params: StreamTextParams): AsyncIterable<StreamEvent>;
}

// ============= Provider Config =============

export type ApiMode = "auto" | "chat-completions" | "responses";

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  oauthToken?: string;
  baseUrl?: string;
  apiMode?: ApiMode;
  enterpriseDomain?: string;
  accountId?: string;
}

// ============= Input Types =============

export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface StreamTextParams {
  model: string;
  systemPrompt: string;
  messages: AIMessage[];
  tools: ToolDefinition[];
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  abortSignal?: AbortSignal;
}

export type AIMessage = UserMessage | AssistantMessage | ToolResultMessage;

export interface UserMessage {
  role: "user";
  content: UserContent[];
}

export type UserContent =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

export interface AssistantMessage {
  role: "assistant";
  content: AssistantContent[];
}

export type AssistantContent =
  | { type: "text"; text: string }
  | {
      type: "tool-call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      providerOptions?: Record<string, Record<string, unknown>>;
    };

export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
  result: string;
  isError?: boolean;
}

// ============= Tool Definition =============

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export type JsonSchema = Record<string, unknown>;

// ============= Output Types =============

export type StreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | {
      type: "tool-input-start";
      id: string;
      name: string;
      providerOptions?: Record<string, Record<string, unknown>>;
    }
  | { type: "tool-input-delta"; id: string; delta: string }
  | {
      type: "tool-call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      providerOptions?: Record<string, Record<string, unknown>>;
    }
  | {
      type: "tool-result";
      id: string;
      name: string;
      result: unknown;
    }
  | { type: "finish"; usage?: TokenUsage; finishReason: FinishReason }
  | { type: "error"; error: AppError };

export type FinishReason = "stop" | "tool-calls" | "length" | "error" | "other";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    textTokens?: number;
    reasoningTokens?: number;
  };
}
