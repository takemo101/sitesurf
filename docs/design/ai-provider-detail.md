# AI Provider 詳細設計

## 概要

本ドキュメントは [AI接続設計](../architecture/ai-connection.md) を具体化し、
Port の型定義、Adapter の内部設計、provider-factory のロジックを定める。

## Port の完全な型定義

### AIProvider

```typescript
// ports/ai-provider.ts

import type { AppError } from "@/shared/errors";

// ============= Core Interface =============

export interface AIProvider {
  streamText(params: StreamTextParams): AsyncIterable<StreamEvent>;
}

// ============= Input Types =============

export interface StreamTextParams {
  model: string;
  systemPrompt: string;
  messages: AIMessage[];
  tools: ToolDefinition[];
  maxTokens?: number; // デフォルト: DEFAULT_MAX_TOKENS (現状 8192)
  abortSignal?: AbortSignal;
}

/** Anthropic / OpenAI 両互換のメッセージ形式。SDK非依存。 */
export type AIMessage = UserMessage | AssistantMessage | ToolResultMessage;

export interface UserMessage {
  role: "user";
  content: UserContent[];
}

export type UserContent =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string }; // base64

export interface AssistantMessage {
  role: "assistant";
  content: AssistantContent[];
}

export type AssistantContent =
  | { type: "text"; text: string }
  | { type: "tool-call"; id: string; name: string; args: Record<string, unknown> };

export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
  result: string;
  isError?: boolean;
}

// ============= Tool Definition =============

/** AI SDK の tool() を使わず、Port 独自の定義。Adapter 側で SDK 形式に変換する */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema; // JSON Schema 形式
}

export type JsonSchema = Record<string, unknown>;

// ============= Output Types =============

export type StreamEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "finish"; usage?: TokenUsage; finishReason: FinishReason }
  | { type: "error"; error: AppError };

export type FinishReason = "stop" | "tool-calls" | "length" | "error";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

### 設計判断

**Q: なぜ Vercel AI SDK の CoreMessage を直接使わないのか？**

A: Port は Adapter の具体実装に依存してはならない。AI SDK のメッセージ形式は
SDK のバージョンアップで変わりうる。Port 独自の `AIMessage` を定義し、
Adapter 側で変換することで、SDK の変更を `adapters/ai/` 内に閉じ込める。

**Q: なぜ ToolDefinition を Port で定義し、AI SDK の tool() を使わないのか？**

A: `tool()` は execute 関数を含む。Port のツール定義は「AIに渡すスキーマ」に限定し、
ツール実行は orchestration 層の責務とする。これにより定義と実行が分離される。

## Vercel AI SDK Adapter 内部設計

### vercel-ai-adapter.ts

```typescript
// adapters/ai/vercel-ai-adapter.ts

import { streamText as sdkStreamText } from "ai";
import type { LanguageModel } from "ai";
import type { AIProvider, StreamTextParams, StreamEvent } from "@/ports/ai-provider";
import { toSDKMessages, toSDKTools, toStreamEvent, toAIError } from "./converters";

export class VercelAIAdapter implements AIProvider {
  constructor(private readonly modelFactory: (model: string) => LanguageModel) {}

  async *streamText(params: StreamTextParams): AsyncIterable<StreamEvent> {
    const model = this.modelFactory(params.model);
    const sdkMessages = toSDKMessages(params.messages);
    const sdkTools = toSDKTools(params.tools);

    const result = sdkStreamText({
      model,
      system: params.systemPrompt,
      messages: sdkMessages,
      tools: sdkTools,
      maxTokens: params.maxTokens, // 未指定時は設定ストアの既定値を使用
      abortSignal: params.abortSignal,
    });

    try {
      for await (const part of result.fullStream) {
        const event = toStreamEvent(part);
        if (event) yield event;
      }
    } catch (error: unknown) {
      yield { type: "error", error: toAIError(error) };
    }
  }
}
```

### converters.ts (型変換)

```typescript
// adapters/ai/converters.ts

import type { CoreMessage } from "ai";
import { jsonSchema } from "ai";
import type { AIMessage, ToolDefinition, StreamEvent, FinishReason } from "@/ports/ai-provider";
import type { AIError } from "@/shared/errors";

/** Port の AIMessage[] → Vercel AI SDK の CoreMessage[] */
export function toSDKMessages(messages: AIMessage[]): CoreMessage[] {
  return messages.map((msg): CoreMessage => {
    switch (msg.role) {
      case "user":
        return {
          role: "user",
          content: msg.content.map((c) => {
            if (c.type === "text") return { type: "text", text: c.text };
            if (c.type === "image") return { type: "image", image: c.data, mimeType: c.mimeType };
            throw new Error(`Unknown user content type`);
          }),
        };
      case "assistant":
        return {
          role: "assistant",
          content: msg.content.map((c) => {
            if (c.type === "text") return { type: "text", text: c.text };
            if (c.type === "tool-call")
              return { type: "tool-call", toolCallId: c.id, toolName: c.name, args: c.args };
            throw new Error(`Unknown assistant content type`);
          }),
        };
      case "tool":
        return {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              result: msg.result,
              isError: msg.isError,
            },
          ],
        };
    }
  });
}

/**
 * Port の ToolDefinition[] → Vercel AI SDK の tools オブジェクト
 *
 * Vercel AI SDK は JSON Schema を直接受け付ける jsonSchema() ヘルパーを提供している。
 * Zod 変換は不要。
 */
export function toSDKTools(
  tools: ToolDefinition[],
): Record<string, { description: string; parameters: unknown }> {
  const result: Record<string, { description: string; parameters: unknown }> = {};
  for (const t of tools) {
    result[t.name] = {
      description: t.description,
      parameters: jsonSchema(t.parameters),
    };
  }
  return result;
}

/** Vercel AI SDK の stream part → Port の StreamEvent */
export function toStreamEvent(part: unknown): StreamEvent | null {
  const p = part as Record<string, unknown>;
  switch (p.type) {
    case "text-delta":
      return { type: "text-delta", text: p.textDelta as string };
    case "tool-call":
      return {
        type: "tool-call",
        id: p.toolCallId as string,
        name: p.toolName as string,
        args: p.args as Record<string, unknown>,
      };
    case "finish":
      return {
        type: "finish",
        finishReason: mapFinishReason(p.finishReason),
        usage: p.usage as any,
      };
    case "error":
      return { type: "error", error: toAIError(p.error) };
    default:
      return null;
  }
}

function mapFinishReason(reason: unknown): FinishReason {
  if (reason === "stop" || reason === "end-turn") return "stop";
  if (reason === "tool-calls") return "tool-calls";
  if (reason === "length") return "length";
  return "error";
}

/** SDK/API エラーを AIError に変換 */
export function toAIError(error: unknown): AIError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("429"))
      return {
        code: "ai_rate_limit",
        message: "APIのレート制限に達しました。しばらく待ってから再試行してください。",
        cause: error,
      };
    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("invalid api key"))
      return {
        code: "ai_auth_invalid",
        message: "APIキーが無効です。設定を確認してください。",
        cause: error,
      };
    if (msg.includes("model") && msg.includes("not found"))
      return {
        code: "ai_model_not_found",
        message: "指定されたモデルが見つかりません。",
        cause: error,
      };
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED"))
      return {
        code: "ai_network",
        message: "AIサービスに接続できません。ネットワーク接続を確認してください。",
        cause: error,
      };
  }
  return { code: "ai_unknown", message: `AI APIエラー: ${String(error)}`, cause: error };
}
```

### provider-factory.ts

```typescript
// adapters/ai/provider-factory.ts

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { ProviderId } from "@/shared/constants";

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  oauthToken?: string;
  baseUrl?: string;
  enterpriseDomain?: string; // Copilot GHES 用
}

export function createModelFactory(config: ProviderConfig): (modelId: string) => LanguageModel {
  switch (config.provider) {
    case "anthropic": {
      const client = createAnthropic({
        apiKey: config.apiKey!,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      });
      return (model) => client(model);
    }
    case "openai": {
      const client = createOpenAI({ apiKey: config.oauthToken ?? config.apiKey! });
      return (model) => client(model);
    }
    case "google": {
      const client = createGoogleGenerativeAI({ apiKey: config.apiKey! });
      return (model) => client(model);
    }
    case "copilot": {
      // enterpriseDomain は credentials.metadata.enterpriseDomain から取得
      const baseURL = getCopilotBaseUrl(config.oauthToken, config.enterpriseDomain);
      const client = createOpenAI({
        baseURL,
        apiKey: config.oauthToken!,
        headers: {
          "Editor-Version": "vscode/1.107.0",
          "Editor-Plugin-Version": "copilot-chat/0.35.0",
          "Copilot-Integration-Id": "vscode-chat",
        },
      });
      return (model) => client(model);
    }
    case "local": {
      const baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/$/, "");
      const client = createOpenAI({ baseURL: `${baseUrl}/v1`, apiKey: "ollama" });
      return (model) => client(model);
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

function getCopilotBaseUrl(token: string): string {
  const match = token.match(/proxy-ep=([^;]+)/);
  if (match) {
    const apiHost = match[1].replace(/^proxy\./, "api.");
    return `https://${apiHost}`;
  }
  return "https://api.individual.githubcopilot.com";
}
```

## AIProvider の生成と注入

### 生成場所の一元化

**`orchestration/agent-loop.ts` が呼び出しのたびに AIProvider を生成する。**

DepsContext には `modelFactory` (provider-factory の `createModelFactory`) を注入し、
agent-loop が `VercelAIAdapter` を組み立てる。

理由:

- 認証トークンのリフレッシュ後に `ProviderConfig` が変わるため、呼び出しごとの生成が必要
- `useMemo` で React 側にキャッシュすると、リフレッシュ後の再生成タイミングが複雑になる

```typescript
// sidepanel/DepsContext.tsx
export interface AppDeps {
  createModelFactory: typeof createModelFactory; // ファクトリのファクトリ
  authProviders: Record<string, AuthProvider>;
  browserExecutor: BrowserExecutor;
  storage: StoragePort;
  sessionStorage: SessionStoragePort;
}
```

```typescript
// orchestration/agent-loop.ts
async function resolveAIProvider(
  settings: Settings,
  deps: AppDeps,
): Promise<Result<AIProvider, AuthError>> {
  let credentials = settings.credentials;

  // OAuth リフレッシュ
  if (credentials) {
    const auth = deps.authProviders[settings.provider];
    if (auth && !auth.isValid(credentials)) {
      const refreshResult = await auth.refresh(credentials);
      if (!refreshResult.ok) return refreshResult;
      credentials = refreshResult.value;
      await deps.storage.set("tandemweb_settings", { ...settings, credentials });
      useStore.getState().setCredentials(credentials);
    }
  }

  const factory = deps.createModelFactory({
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey,
    oauthToken: credentials?.accessToken,
    enterpriseDomain: credentials?.metadata?.enterpriseDomain,
    baseUrl: settings.baseUrl,
  });

  return ok(new VercelAIAdapter(factory));
}
```

## 関連ドキュメント

- [AI接続設計 (アーキテクチャ)](../architecture/ai-connection.md) - 方針レベル
- [トークン管理設計](./token-management-detail.md) - 認証の詳細
- [エラーハンドリング](../architecture/error-handling.md) - AIError の定義
- [パッケージ構成](../architecture/package-structure.md) - ファイル配置
- [OpenAI OAuth 詳細設計](./openai-oauth-detail.md) - OpenAI Codex OAuth 対応
