import { describe, expect, it } from "vitest";
import { PROVIDERS, THEME_STORAGE_KEY } from "../constants";
import type { ProviderId, ProviderInfo, ColorScheme } from "../constants";

describe("PROVIDERS定数", () => {
  const expectedIds: ProviderId[] = [
    "anthropic",
    "openai",
    "openai-codex",
    "google",
    "copilot",
    "kimi",
    "kimi-coding",
    "zai",
    "zai-coding",
    "local",
    "ollama",
  ];

  it("11プロバイダーが定義されている", () => {
    expect(Object.keys(PROVIDERS)).toHaveLength(11);
  });

  it.each(expectedIds)("%s が存在する", (id) => {
    expect(PROVIDERS[id]).toBeDefined();
  });

  it.each(expectedIds)("%s の id がキーと一致する", (id) => {
    expect(PROVIDERS[id].id).toBe(id);
  });

  it.each(expectedIds)("%s に必須フィールドがある", (id) => {
    const provider: ProviderInfo = PROVIDERS[id];
    expect(provider.name).toBeTruthy();
    expect(provider.defaultModel).toBeTruthy();
    expect(Array.isArray(provider.models)).toBe(true);
    expect(["apikey", "oauth", "none"]).toContain(provider.authType);
  });

  it("anthropic は apikey 認証", () => {
    expect(PROVIDERS.anthropic.authType).toBe("apikey");
    expect(PROVIDERS.anthropic.placeholder).toBeDefined();
  });

  it("openai は apikey 認証", () => {
    expect(PROVIDERS.openai.authType).toBe("apikey");
    expect(PROVIDERS.openai.placeholder).toBeDefined();
  });

  it("openai-codex は oauth 認証", () => {
    expect(PROVIDERS["openai-codex"].authType).toBe("oauth");
  });

  it("local は apikey 認証で models が空", () => {
    expect(PROVIDERS.local.authType).toBe("apikey");
    expect(PROVIDERS.local.models).toHaveLength(0);
  });

  it("ollama は none 認証で models が空", () => {
    expect(PROVIDERS.ollama.authType).toBe("none");
    expect(PROVIDERS.ollama.models).toHaveLength(0);
  });

  it("copilot は oauth 認証", () => {
    expect(PROVIDERS.copilot.authType).toBe("oauth");
  });

  it("google は apikey 認証", () => {
    expect(PROVIDERS.google.authType).toBe("apikey");
  });
});

describe("THEME_STORAGE_KEY", () => {
  it("文字列定数が定義されている", () => {
    expect(THEME_STORAGE_KEY).toBe("sitesurf_theme");
  });
});

describe("ColorScheme型", () => {
  it("auto/light/dark が代入可能", () => {
    const schemes: ColorScheme[] = ["auto", "light", "dark"];
    expect(schemes).toHaveLength(3);
  });
});
