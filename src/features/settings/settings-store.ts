import type { StateCreator } from "zustand";
import { PROVIDERS, type ProviderId } from "@/shared/constants";
import type { AuthCredentials } from "@/ports/auth-provider";
import type { AppStore } from "@/store/types";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";

export type { AuthCredentials };

export type ReasoningLevel = "none" | "low" | "medium" | "high";
export type ApiMode = "auto" | "chat-completions" | "responses";

export interface Settings {
  provider: ProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  apiMode: ApiMode;
  enterpriseDomain: string;
  credentials: AuthCredentials | null;
  credentialsByProvider: Partial<Record<ProviderId, AuthCredentials>>;
  apiKeyByProvider: Partial<Record<ProviderId, string>>;
  baseUrlByProvider: Partial<Record<ProviderId, string>>;
  apiModeByProvider: Partial<Record<ProviderId, ApiMode>>;
  modelByProvider: Partial<Record<ProviderId, string>>;
  reasoningLevelByProvider: Partial<Record<ProviderId, ReasoningLevel>>;
  maxTokensByProvider: Partial<Record<ProviderId, number>>;
  reasoningLevel: ReasoningLevel;
  maxTokens: number;
  autoCompact: boolean;
  enableMcpServer: boolean;
  enableBgFetch: boolean;
  enableSecurityMiddleware: boolean;
}

export interface SettingsSlice {
  settings: Settings;
  setSettings(partial: Partial<Settings>): void;
  hydrateSettings(settings: Settings): void;
  setCredentials(creds: AuthCredentials | null): void;
}

function resolveModel(model: string | undefined, fallback: string): string {
  return model && model.length > 0 ? model : fallback;
}

export const createSettingsSlice: StateCreator<AppStore, [], [], SettingsSlice> = (set, _get) => ({
  settings: {
    provider: "anthropic",
    model: "",
    apiKey: "",
    baseUrl: "",
    apiMode: "auto",
    enterpriseDomain: "",
    credentials: null,
    credentialsByProvider: {},
    apiKeyByProvider: {},
    baseUrlByProvider: {},
    apiModeByProvider: {},
    modelByProvider: {},
    reasoningLevelByProvider: {},
    maxTokensByProvider: {},
    reasoningLevel: "medium",
    maxTokens: DEFAULT_MAX_TOKENS,
    autoCompact: false,
    enableMcpServer: false,
    enableBgFetch: false,
    enableSecurityMiddleware: true,
  },
  setSettings: (partial) =>
    set((s) => {
      const currentProvider = s.settings.provider;
      const targetProvider = partial.provider ?? currentProvider;
      const next = { ...s.settings, ...partial };

      const providerChanged = targetProvider !== currentProvider;

      if (!providerChanged && partial.apiKey !== undefined) {
        next.apiKeyByProvider = {
          ...next.apiKeyByProvider,
          [currentProvider]: partial.apiKey,
        };
        next.apiKey = partial.apiKey;
      }
      if (!providerChanged && partial.baseUrl !== undefined) {
        next.baseUrlByProvider = {
          ...next.baseUrlByProvider,
          [currentProvider]: partial.baseUrl,
        };
        next.baseUrl = partial.baseUrl;
      }
      if (!providerChanged && partial.apiMode !== undefined) {
        next.apiModeByProvider = {
          ...next.apiModeByProvider,
          [currentProvider]: partial.apiMode,
        };
        next.apiMode = partial.apiMode;
      }
      if (!providerChanged && partial.model !== undefined) {
        next.modelByProvider = {
          ...next.modelByProvider,
          [currentProvider]: partial.model,
        };
        next.model = resolveModel(partial.model, PROVIDERS[currentProvider].defaultModel);
      }
      if (!providerChanged && partial.reasoningLevel !== undefined) {
        next.reasoningLevelByProvider = {
          ...next.reasoningLevelByProvider,
          [currentProvider]: partial.reasoningLevel,
        };
      }
      if (!providerChanged && partial.maxTokens !== undefined) {
        next.maxTokensByProvider = {
          ...next.maxTokensByProvider,
          [currentProvider]: partial.maxTokens,
        };
      }

      if (providerChanged) {
        const prevProvider = currentProvider;
        next.apiKeyByProvider = {
          ...next.apiKeyByProvider,
          [prevProvider]: s.settings.apiKey,
        };
        next.baseUrlByProvider = {
          ...next.baseUrlByProvider,
          [prevProvider]: s.settings.baseUrl,
        };
        next.apiModeByProvider = {
          ...next.apiModeByProvider,
          [prevProvider]: s.settings.apiMode,
        };
        if (s.settings.model.length > 0) {
          next.modelByProvider = {
            ...next.modelByProvider,
            [prevProvider]: s.settings.model,
          };
        }
        next.reasoningLevelByProvider = {
          ...next.reasoningLevelByProvider,
          [prevProvider]: s.settings.reasoningLevel,
        };
        next.maxTokensByProvider = {
          ...next.maxTokensByProvider,
          [prevProvider]: s.settings.maxTokens,
        };

        next.apiKey = partial.apiKey ?? next.apiKeyByProvider[targetProvider] ?? "";
        next.baseUrl = partial.baseUrl ?? next.baseUrlByProvider[targetProvider] ?? "";
        next.apiMode = partial.apiMode ?? next.apiModeByProvider[targetProvider] ?? "auto";
        next.credentials = next.credentialsByProvider[targetProvider] ?? null;

        next.model = resolveModel(
          next.modelByProvider[targetProvider] ?? partial.model,
          PROVIDERS[targetProvider].defaultModel,
        );
        next.reasoningLevel =
          next.reasoningLevelByProvider[targetProvider] ?? partial.reasoningLevel ?? "medium";
        next.maxTokens =
          next.maxTokensByProvider[targetProvider] ?? partial.maxTokens ?? DEFAULT_MAX_TOKENS;

        if (partial.apiKey !== undefined) {
          next.apiKeyByProvider = {
            ...next.apiKeyByProvider,
            [targetProvider]: partial.apiKey,
          };
        }
        if (partial.baseUrl !== undefined) {
          next.baseUrlByProvider = {
            ...next.baseUrlByProvider,
            [targetProvider]: partial.baseUrl,
          };
        }
        if (partial.apiMode !== undefined) {
          next.apiModeByProvider = {
            ...next.apiModeByProvider,
            [targetProvider]: partial.apiMode,
          };
        }
        if (partial.model !== undefined && next.modelByProvider[targetProvider] === undefined) {
          next.modelByProvider = {
            ...next.modelByProvider,
            [targetProvider]: partial.model,
          };
        }
        if (
          partial.reasoningLevel !== undefined &&
          next.reasoningLevelByProvider[targetProvider] === undefined
        ) {
          next.reasoningLevelByProvider = {
            ...next.reasoningLevelByProvider,
            [targetProvider]: partial.reasoningLevel,
          };
        }
        if (
          partial.maxTokens !== undefined &&
          next.maxTokensByProvider[targetProvider] === undefined
        ) {
          next.maxTokensByProvider = {
            ...next.maxTokensByProvider,
            [targetProvider]: partial.maxTokens,
          };
        }
      }
      return { settings: next };
    }),
  hydrateSettings: (settings) => set({ settings }),
  setCredentials: (creds) =>
    set((s) => {
      const provider = s.settings.provider;
      const byProvider = { ...s.settings.credentialsByProvider };
      if (creds) {
        byProvider[provider] = creds;
      } else {
        delete byProvider[provider];
      }
      return {
        settings: { ...s.settings, credentials: creds, credentialsByProvider: byProvider },
      };
    }),
});
