import { GENERATED_MODELS } from "./models.generated";

export const THEME_STORAGE_KEY = "sitesurf_theme";
export const LEGACY_THEME_STORAGE_KEY = "tandemweb_theme";

export type ColorScheme = "auto" | "light" | "dark";

export type ProviderId =
  | "anthropic"
  | "openai"
  | "openai-codex"
  | "google"
  | "copilot"
  | "kimi"
  | "kimi-coding"
  | "zai"
  | "zai-coding"
  | "ollama"
  | "local";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  defaultModel: string;
  models: string[];
  authType: "apikey" | "oauth" | "none";
  placeholder?: string;
}

function modelsFor(key: string, fallback?: string[]): string[] {
  const generated = (GENERATED_MODELS[key]?.models ?? []).map((m) => m.id);
  if (generated.length === 0) return fallback ?? [];
  return [...new Set([...generated, ...(fallback ?? [])])];
}

function defaultFor(key: string, fallback: string): string {
  return GENERATED_MODELS[key]?.defaultModel ?? fallback;
}

// Codex APIで利用可能なモデル (pi-mono参考)
const CODEX_MODELS = [
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gpt-5.2",
  "gpt-5.2-codex",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.4",
  "gpt-5.4-mini",
];

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic (Claude)",
    defaultModel: defaultFor("anthropic", "claude-sonnet-4-6"),
    models: modelsFor("anthropic"),
    authType: "apikey",
    placeholder: "sk-ant-...",
  },
  openai: {
    id: "openai",
    name: "OpenAI (API)",
    defaultModel: defaultFor("openai", "gpt-5.4"),
    models: modelsFor("openai"),
    authType: "apikey",
    placeholder: "sk-...",
  },
  "openai-codex": {
    id: "openai-codex",
    name: "OpenAI (ChatGPT/Codex)",
    defaultModel: "gpt-5.1-codex-mini",
    models: CODEX_MODELS,
    authType: "oauth",
  },
  google: {
    id: "google",
    name: "Google (Gemini)",
    defaultModel: defaultFor("google", "gemini-2.5-flash"),
    models: modelsFor("google"),
    authType: "apikey",
    placeholder: "AIza...",
  },
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    defaultModel: defaultFor("copilot", "gpt-4.1"),
    models: modelsFor("copilot"),
    authType: "oauth",
  },
  kimi: {
    id: "kimi",
    name: "Kimi (Moonshot AI)",
    defaultModel: defaultFor("kimi", "kimi-k2.6"),
    models: modelsFor("kimi", [
      "kimi-k2.6",
      "kimi-k2.5",
      "kimi-k2-turbo-preview",
      "kimi-k2-0905-preview",
      "kimi-k2-thinking",
      "kimi-k2-thinking-turbo",
      "moonshot-v1-128k",
      "moonshot-v1-32k",
      "moonshot-v1-8k",
    ]),
    authType: "apikey",
    placeholder: "sk-...",
  },
  "kimi-coding": {
    id: "kimi-coding",
    name: "Kimi for Coding",
    defaultModel: defaultFor("kimi-coding", "k2p6"),
    models: modelsFor("kimi-coding", ["k2p6", "k2p5", "kimi-k2-thinking"]),
    authType: "apikey",
    placeholder: "sk-...",
  },
  zai: {
    id: "zai",
    name: "Z.AI (Zhipu)",
    defaultModel: defaultFor("zai", "glm-5.1"),
    models: modelsFor("zai", ["glm-5.1", "glm-5-turbo", "glm-4.7", "glm-4.7-flash"]),
    authType: "apikey",
    placeholder: "zhipu-...",
  },
  "zai-coding": {
    id: "zai-coding",
    name: "Z.AI Coding Plan",
    defaultModel: defaultFor("zai-coding", "glm-5.1"),
    models: modelsFor("zai-coding", ["glm-5.1", "glm-5-turbo", "glm-4.7", "glm-4.5-air"]),
    authType: "apikey",
    placeholder: "zhipu-...",
  },
  local: {
    id: "local",
    name: "ローカルLLM (OpenAI互換)",
    defaultModel: "llama3.2",
    models: [],
    authType: "apikey",
    placeholder: "APIキー (任意)",
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    defaultModel: "llama3.2",
    models: [],
    authType: "none",
  },
};
