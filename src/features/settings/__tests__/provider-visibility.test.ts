import { describe, expect, it } from "vitest";

import type { ProviderId } from "@/shared/constants";
import { getFieldVisibility } from "../provider-visibility";

describe("getFieldVisibility", () => {
  it("Anthropic: モデル選択 + APIキー + エンドポイント表示", () => {
    const v = getFieldVisibility("anthropic");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(false);
  });

  it("OpenAI: モデル選択 + APIキー + エンドポイント + APIモード表示", () => {
    const v = getFieldVisibility("openai");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(true);
    expect(v.showOAuth).toBe(false);
  });

  it("OpenAI Codex: モデル選択 + エンドポイント + OAuth表示", () => {
    const v = getFieldVisibility("openai-codex");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(false);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(true);
  });

  it("Google: モデル選択 + APIキー + エンドポイント表示", () => {
    const v = getFieldVisibility("google");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(false);
  });

  it("Copilot: モデル選択 + APIキー + OAuth + APIモード表示", () => {
    const v = getFieldVisibility("copilot");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(true);
    expect(v.showOAuth).toBe(true);
  });

  it("Kimi: モデル選択 + APIキー + エンドポイント表示", () => {
    const v = getFieldVisibility("kimi");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(false);
  });

  it("ローカルLLM: モデル入力 + エンドポイント + APIキー + APIモード表示", () => {
    const v = getFieldVisibility("local");
    expect(v.showModelSelect).toBe(false);
    expect(v.showModelInput).toBe(true);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(true);
    expect(v.showOAuth).toBe(false);
  });

  it("Kimi for Coding: モデル選択 + APIキー + エンドポイント表示", () => {
    const v = getFieldVisibility("kimi-coding");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(false);
  });

  it("Z.AI: モデル選択 + APIキー + エンドポイント表示", () => {
    const v = getFieldVisibility("zai");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(false);
  });

  it("Z.AI Coding Plan: モデル選択 + APIキー + エンドポイント表示", () => {
    const v = getFieldVisibility("zai-coding");
    expect(v.showModelSelect).toBe(true);
    expect(v.showModelInput).toBe(false);
    expect(v.showApiKey).toBe(true);
    expect(v.showBaseUrl).toBe(true);
    expect(v.showApiMode).toBe(false);
    expect(v.showOAuth).toBe(false);
  });

  it("全プロバイダーで排他的なフィールドが正しい", () => {
    const providers: ProviderId[] = [
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
    for (const id of providers) {
      const v = getFieldVisibility(id);
      expect(v.showModelSelect).not.toBe(v.showModelInput);
    }
  });
});
