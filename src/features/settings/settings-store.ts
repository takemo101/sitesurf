import type { StateCreator } from "zustand";
import type { ProviderId } from "@/shared/constants";
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
  reasoningLevel: ReasoningLevel;
  maxTokens: number;
  enableMcpServer: boolean;
}

export interface SettingsSlice {
  settings: Settings;
  setSettings(partial: Partial<Settings>): void;
  setCredentials(creds: AuthCredentials | null): void;
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
    reasoningLevel: "medium",
    maxTokens: DEFAULT_MAX_TOKENS,
    enableMcpServer: false,
  },
  setSettings: (partial) =>
    set((s) => {
      const next = { ...s.settings, ...partial };
      const currentProvider = s.settings.provider;

      if (partial.apiKey !== undefined) {
        next.apiKeyByProvider = {
          ...next.apiKeyByProvider,
          [currentProvider]: partial.apiKey,
        };
      }
      if (partial.baseUrl !== undefined) {
        next.baseUrlByProvider = {
          ...next.baseUrlByProvider,
          [currentProvider]: partial.baseUrl,
        };
      }
      if (partial.apiMode !== undefined) {
        next.apiModeByProvider = {
          ...next.apiModeByProvider,
          [currentProvider]: partial.apiMode,
        };
      }

      if (partial.provider && partial.provider !== currentProvider) {
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
        next.apiKey = next.apiKeyByProvider[partial.provider] ?? "";
        next.baseUrl = next.baseUrlByProvider[partial.provider] ?? "";
        next.apiMode = next.apiModeByProvider[partial.provider] ?? "auto";
        next.credentials = next.credentialsByProvider[partial.provider] ?? null;
      }
      return { settings: next };
    }),
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
