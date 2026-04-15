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
      apiKeyByProvider: {},
      baseUrlByProvider: {},
      apiModeByProvider: {},
      reasoningLevel: "medium",
      maxTokens: 8192,
      enableMcpServer: false,
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
      apiKeyByProvider: {},
      baseUrlByProvider: {},
      apiModeByProvider: {},
      reasoningLevel: "medium",
      maxTokens: 8192,
      enableMcpServer: false,
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
      apiKeyByProvider: {},
      baseUrlByProvider: {},
      apiModeByProvider: {},
      reasoningLevel: "high",
      maxTokens: 8192,
      enableMcpServer: false,
    };

    await saveSettings(storage, data1);
    await saveSettings(storage, data2);
    const result = await loadSettings(storage);

    expect(result).toEqual(data2);
  });
});
