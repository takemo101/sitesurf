import { describe, expect, it } from "vitest";

import { InMemoryStorage } from "@/adapters/storage/in-memory-storage";

import { loadSettings, saveSettings } from "../persistence";
import type { Settings } from "../settings-store";

describe("persistence", () => {
  it("設定がない場合は null を返す", async () => {
    const storage = new InMemoryStorage();
    const result = await loadSettings(storage);
    expect(result).toBeNull();
  });

  it("設定を保存して読み込める", async () => {
    const storage = new InMemoryStorage();
    const data: Settings = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "sk-ant-test",
      baseUrl: "",
      apiMode: "auto",
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: { anthropic: "sk-ant-test" },
      baseUrlByProvider: { anthropic: "" },
      apiModeByProvider: { anthropic: "auto" },
      modelByProvider: { anthropic: "claude-sonnet-4-20250514" },
      reasoningLevelByProvider: { anthropic: "medium" },
      maxTokensByProvider: { anthropic: 8192 },
      reasoningLevel: "medium",
      maxTokens: 8192,
      autoCompact: false,
      enableMcpServer: false,
      enableBgFetch: false,
      enableSecurityMiddleware: true,
    };

    await saveSettings(storage, data);
    const result = await loadSettings(storage);

    expect(result).toEqual(data);
  });

  it("設定を上書きできる", async () => {
    const storage = new InMemoryStorage();
    const data1: Settings = {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "key1",
      baseUrl: "",
      apiMode: "auto",
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: { anthropic: "key1" },
      baseUrlByProvider: { anthropic: "" },
      apiModeByProvider: { anthropic: "auto" },
      modelByProvider: { anthropic: "claude-sonnet-4-20250514" },
      reasoningLevelByProvider: { anthropic: "medium" },
      maxTokensByProvider: { anthropic: 8192 },
      reasoningLevel: "medium",
      maxTokens: 8192,
      autoCompact: false,
      enableMcpServer: false,
      enableBgFetch: false,
      enableSecurityMiddleware: true,
    };
    const data2: Settings = {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "key2",
      baseUrl: "",
      apiMode: "auto",
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: { openai: "key2" },
      baseUrlByProvider: { openai: "" },
      apiModeByProvider: { openai: "auto" },
      modelByProvider: { openai: "gpt-4o" },
      reasoningLevelByProvider: { openai: "high" },
      maxTokensByProvider: { openai: 8192 },
      reasoningLevel: "high",
      maxTokens: 8192,
      autoCompact: false,
      enableMcpServer: false,
      enableBgFetch: false,
      enableSecurityMiddleware: true,
    };

    await saveSettings(storage, data1);
    await saveSettings(storage, data2);
    const result = await loadSettings(storage);

    expect(result).toEqual(data2);
  });

  it("旧形式の単一値を現在の provider の map に移行する", async () => {
    const storage = new InMemoryStorage();

    await storage.set("sitesurf_settings", {
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "sk-test",
      baseUrl: "",
      apiMode: "auto",
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: {},
      baseUrlByProvider: {},
      apiModeByProvider: {},
      reasoningLevel: "high",
      maxTokens: 32768,
      autoCompact: false,
      enableMcpServer: false,
      enableBgFetch: false,
    });

    const result = await loadSettings(storage);

    expect(result).toMatchObject({
      provider: "openai",
      model: "gpt-4.1",
      credentials: null,
      credentialsByProvider: {},
      reasoningLevel: "high",
      maxTokens: 32768,
      modelByProvider: { openai: "gpt-4.1" },
      reasoningLevelByProvider: { openai: "high" },
      maxTokensByProvider: { openai: 32768 },
    });
  });

  it("疎な legacy settings の credentials を現在 provider に移行する", async () => {
    const storage = new InMemoryStorage();
    const credentials = {
      providerId: "openai",
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: 123,
      metadata: {},
    };

    await storage.set("sitesurf_settings", {
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "sk-test",
      credentials,
      reasoningLevel: "high",
      maxTokens: 32768,
      autoCompact: false,
      enableMcpServer: false,
      enableBgFetch: false,
    });

    const result = await loadSettings(storage);

    expect(result).toMatchObject({
      provider: "openai",
      credentials,
      credentialsByProvider: { openai: credentials },
    });
  });

  it("現在 provider と一致しない credentials は restore しない", async () => {
    const storage = new InMemoryStorage();
    const credentials = {
      providerId: "copilot",
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: 123,
      metadata: {},
    };

    await storage.set("sitesurf_settings", {
      provider: "openai",
      model: "gpt-4.1",
      credentials,
      credentialsByProvider: { openai: credentials },
      enableMcpServer: false,
      enableBgFetch: false,
      autoCompact: false,
    });

    const result = await loadSettings(storage);

    expect(result).toMatchObject({
      provider: "openai",
      credentials: null,
      credentialsByProvider: {},
    });
  });

  it("新旧形式が混在していても map の値を優先する", async () => {
    const storage = new InMemoryStorage();

    await storage.set("sitesurf_settings", {
      provider: "openai",
      model: "legacy-model",
      apiKey: "sk-test",
      baseUrl: "",
      apiMode: "auto",
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: {},
      baseUrlByProvider: {},
      apiModeByProvider: {},
      modelByProvider: { openai: "gpt-4.1" },
      reasoningLevelByProvider: { openai: "low" },
      maxTokensByProvider: { openai: 4096 },
      reasoningLevel: "high",
      maxTokens: 32768,
      enableMcpServer: false,
      enableBgFetch: false,
      autoCompact: false,
    });

    const result = await loadSettings(storage);

    expect(result).toMatchObject({
      provider: "openai",
      model: "gpt-4.1",
      reasoningLevel: "low",
      maxTokens: 4096,
      modelByProvider: { openai: "gpt-4.1" },
      reasoningLevelByProvider: { openai: "low" },
      maxTokensByProvider: { openai: 4096 },
    });
  });

  it("provider map の model が空文字なら default model にフォールバックする", async () => {
    const storage = new InMemoryStorage();

    await storage.set("sitesurf_settings", {
      provider: "anthropic",
      model: "claude-opus-4-1",
      apiKey: "sk-test",
      baseUrl: "",
      apiMode: "auto",
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: {},
      baseUrlByProvider: {},
      apiModeByProvider: {},
      modelByProvider: { anthropic: "" },
      reasoningLevelByProvider: { anthropic: "medium" },
      maxTokensByProvider: { anthropic: 8192 },
      reasoningLevel: "medium",
      maxTokens: 8192,
      autoCompact: false,
      enableMcpServer: false,
      enableBgFetch: false,
    });

    const result = await loadSettings(storage);

    expect(result).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      modelByProvider: { anthropic: "" },
    });
  });

  it("enableSecurityMiddleware 未設定の legacy 設定はデフォルトで true に解決する", async () => {
    const storage = new InMemoryStorage();

    await storage.set("sitesurf_settings", {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      apiKey: "sk-test",
      enableMcpServer: false,
      enableBgFetch: false,
      autoCompact: false,
    });

    const result = await loadSettings(storage);

    expect(result?.enableSecurityMiddleware).toBe(true);
  });

  it("enableSecurityMiddleware=false は永続化されて復元される", async () => {
    const storage = new InMemoryStorage();

    await storage.set("sitesurf_settings", {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      apiKey: "sk-test",
      enableMcpServer: false,
      enableBgFetch: false,
      enableSecurityMiddleware: false,
      autoCompact: true,
    });

    const result = await loadSettings(storage);

    expect(result?.enableSecurityMiddleware).toBe(false);
    expect(result?.autoCompact).toBe(true);
  });

  it("autoCompact 未設定の legacy 設定はデフォルトで false に解決する", async () => {
    const storage = new InMemoryStorage();

    await storage.set("sitesurf_settings", {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      apiKey: "sk-test",
      enableMcpServer: false,
      enableBgFetch: false,
    });

    const result = await loadSettings(storage);

    expect(result?.autoCompact).toBe(false);
  });
});
