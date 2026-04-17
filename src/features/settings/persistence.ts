import type { StoragePort } from "@/ports/storage";
import { PROVIDERS, type ProviderId } from "@/shared/constants";
import type { Settings } from "./settings-store";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";

const STORAGE_KEY = "sitesurf_settings";
const LEGACY_STORAGE_KEY = "tandemweb_settings";

function resolveModel(model: string | undefined, fallback: string): string {
  return model && model.length > 0 ? model : fallback;
}

function isProviderId(value: string): value is ProviderId {
  return Object.hasOwn(PROVIDERS, value);
}

function matchesProvider(
  credentials: Settings["credentials"] | undefined,
  provider: ProviderId,
): credentials is NonNullable<Settings["credentials"]> {
  return credentials !== null && credentials !== undefined && credentials.providerId === provider;
}

export async function loadSettings(storage: StoragePort): Promise<Settings | null> {
  const raw =
    (await storage.get<Partial<Settings>>(STORAGE_KEY)) ??
    (await storage.get<Partial<Settings>>(LEGACY_STORAGE_KEY));
  if (!raw) return null;

  const provider =
    typeof raw.provider === "string" && isProviderId(raw.provider) ? raw.provider : "anthropic";
  const credentialsByProvider = { ...raw.credentialsByProvider };
  const apiKeyByProvider = { ...raw.apiKeyByProvider };
  const baseUrlByProvider = { ...raw.baseUrlByProvider };
  const apiModeByProvider = { ...raw.apiModeByProvider };
  const modelByProvider = { ...raw.modelByProvider };
  const reasoningLevelByProvider = { ...raw.reasoningLevelByProvider };
  const maxTokensByProvider = { ...raw.maxTokensByProvider };

  if (!matchesProvider(credentialsByProvider[provider], provider)) {
    delete credentialsByProvider[provider];
  }

  if (credentialsByProvider[provider] === undefined && matchesProvider(raw.credentials, provider)) {
    credentialsByProvider[provider] = raw.credentials;
  }
  if (apiKeyByProvider[provider] === undefined && raw.apiKey !== undefined) {
    apiKeyByProvider[provider] = raw.apiKey;
  }
  if (baseUrlByProvider[provider] === undefined && raw.baseUrl !== undefined) {
    baseUrlByProvider[provider] = raw.baseUrl;
  }
  if (apiModeByProvider[provider] === undefined && raw.apiMode !== undefined) {
    apiModeByProvider[provider] = raw.apiMode;
  }
  if (modelByProvider[provider] === undefined && raw.model !== undefined) {
    modelByProvider[provider] = raw.model;
  }
  if (reasoningLevelByProvider[provider] === undefined && raw.reasoningLevel !== undefined) {
    reasoningLevelByProvider[provider] = raw.reasoningLevel;
  }
  if (maxTokensByProvider[provider] === undefined && raw.maxTokens !== undefined) {
    maxTokensByProvider[provider] = raw.maxTokens;
  }

  return {
    provider,
    model: resolveModel(modelByProvider[provider] ?? raw.model, PROVIDERS[provider].defaultModel),
    apiKey: apiKeyByProvider[provider] ?? raw.apiKey ?? "",
    baseUrl: baseUrlByProvider[provider] ?? raw.baseUrl ?? "",
    apiMode: apiModeByProvider[provider] ?? raw.apiMode ?? "auto",
    enterpriseDomain: raw.enterpriseDomain ?? "",
    credentials: credentialsByProvider[provider] ?? null,
    credentialsByProvider,
    apiKeyByProvider,
    baseUrlByProvider,
    apiModeByProvider,
    modelByProvider,
    reasoningLevelByProvider,
    maxTokensByProvider,
    reasoningLevel: reasoningLevelByProvider[provider] ?? raw.reasoningLevel ?? "medium",
    maxTokens: maxTokensByProvider[provider] ?? raw.maxTokens ?? DEFAULT_MAX_TOKENS,
    enableMcpServer: raw.enableMcpServer ?? false,
  };
}

export async function saveSettings(storage: StoragePort, data: Settings): Promise<void> {
  await storage.set(STORAGE_KEY, data);
}
