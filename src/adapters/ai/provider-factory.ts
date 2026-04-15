import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOllama } from "ai-sdk-ollama";
import type { LanguageModel } from "ai";
import type { ProviderConfig } from "@/ports/ai-provider";

export type { ProviderConfig };

// =============================================================================
// Factory Functions
// =============================================================================

export function createModelFactory(config: ProviderConfig): (modelId: string) => LanguageModel {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicFactory(config);

    case "openai":
      return createOpenAIFactory(config);

    case "google":
      return createGoogleFactory(config);

    case "copilot":
      return createCopilotFactory(config);

    case "kimi":
      return createKimiFactory(config);

    case "kimi-coding":
      return createKimiCodingFactory(config);

    case "zai":
      return createZaiFactory(config);

    case "zai-coding":
      return createZaiCodingFactory(config);

    case "local":
    case "ollama":
      return createOllamaFactory(config);

    default:
      throw new Error(`Provider ${config.provider} is not supported by Vercel AI SDK`);
  }
}

// =============================================================================
// Provider-specific Factories
// =============================================================================

function createAnthropicFactory(config: ProviderConfig) {
  const client = createAnthropic({
    apiKey: config.apiKey!,
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });
  return (model: string) => client(model);
}

function createOpenAIFactory(config: ProviderConfig) {
  const client = createOpenAI({
    apiKey: config.apiKey!,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  return (model: string) => {
    switch (config.apiMode) {
      case "chat-completions":
        return client.chat(model);
      case "responses":
        return client.responses(model);
      default:
        return client(model);
    }
  };
}

function createGoogleFactory(config: ProviderConfig) {
  const client = createGoogleGenerativeAI({
    apiKey: config.apiKey!,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });
  return (model: string) => client(model);
}

function createCopilotFactory(config: ProviderConfig) {
  const baseURL = config.baseUrl || getCopilotBaseUrl(config.oauthToken, config.enterpriseDomain);

  const client = createOpenAI({
    baseURL,
    apiKey: config.oauthToken!,
    headers: {
      "Editor-Version": "vscode/1.107.0",
      "Editor-Plugin-Version": "copilot-chat/0.35.0",
      "Copilot-Integration-Id": "vscode-chat",
    },
  });

  return (model: string) => {
    if (config.apiMode === "responses") {
      return client.responses(model);
    }
    return client.chat(model);
  };
}

function createKimiFactory(config: ProviderConfig) {
  const baseURL = config.baseUrl || "https://api.moonshot.ai/v1";
  const client = createOpenAI({
    baseURL,
    apiKey: config.apiKey!,
  });
  return (model: string) => client.chat(model);
}

// Kimi for Coding API は Anthropic プロトコル互換 (opencode/models.dev 準拠)
function createKimiCodingFactory(config: ProviderConfig) {
  const baseURL = config.baseUrl || "https://api.kimi.com/coding/v1";
  const client = createAnthropic({
    baseURL,
    apiKey: config.apiKey!,
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
  });
  return (model: string) => client(model);
}

// Z.AI (Zhipu) は OpenAI 互換プロトコル (models.dev 準拠)
function createZaiFactory(config: ProviderConfig) {
  const baseURL = config.baseUrl || "https://api.z.ai/api/paas/v4";
  const client = createOpenAI({
    baseURL,
    apiKey: config.apiKey!,
  });
  return (model: string) => client.chat(model);
}

function createZaiCodingFactory(config: ProviderConfig) {
  const baseURL = config.baseUrl || "https://api.z.ai/api/coding/paas/v4";
  const client = createOpenAI({
    baseURL,
    apiKey: config.apiKey!,
  });
  return (model: string) => client.chat(model);
}

function createOllamaFactory(config: ProviderConfig) {
  if (config.provider === "ollama") {
    const client = createOllama({
      baseURL: config.baseUrl || "http://localhost:11434",
    });
    return (model: string) => client(model);
  }

  // local provider uses OpenAI-compatible endpoint
  const rawUrl = (config.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  const baseUrl = rawUrl.endsWith("/v1") ? rawUrl : `${rawUrl}/v1`;
  const client = createOpenAI({
    baseURL: baseUrl,
    apiKey: config.apiKey || "ollama",
  });

  return (model: string) => {
    if (config.apiMode === "responses") {
      return client.responses(model);
    }
    return client.chat(model);
  };
}

// =============================================================================
// Utilities
// =============================================================================

export function getCopilotBaseUrl(token?: string, enterpriseDomain?: string): string {
  if (token) {
    const match = token.match(/proxy-ep=([^;]+)/);
    if (match) {
      const apiHost = match[1].replace(/^proxy\./, "api.");
      return `https://${apiHost}`;
    }
  }
  if (enterpriseDomain) return `https://copilot-api.${enterpriseDomain}`;
  return "https://api.individual.githubcopilot.com";
}
