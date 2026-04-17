import { beforeEach, describe, expect, it, vi } from "vitest";

import { initializeApp } from "../initialize";
import { initStore, useStore } from "@/store";
import { InMemoryArtifactStorage, InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import type { AppDeps } from "@/shared/deps-context";
import type { AIProvider, StreamTextParams } from "@/ports/ai-provider";
import type { BrowserExecutor, TabInfo } from "@/ports/browser-executor";
import type { Result, BrowserError, ToolError } from "@/shared/errors";
import type {
  NavigationResult,
  PageContent,
  ScriptResult,
  ElementInfo,
} from "@/ports/browser-executor";
import type { SessionStoragePort } from "@/ports/session-storage";

vi.mock("@/shared/port", () => ({
  initialize: vi.fn(async () => {}),
  sendMessage: vi.fn(async (message: { sessionId: string }) => ({
    type: "lockResult" as const,
    sessionId: message.sessionId,
    success: true,
  })),
}));

class NoopAIProvider implements AIProvider {
  streamText(_params: StreamTextParams): AsyncIterable<never> {
    return {
      async *[Symbol.asyncIterator]() {},
    };
  }
}

class NoopBrowserExecutor implements BrowserExecutor {
  async getActiveTab(): Promise<TabInfo> {
    return { id: 1, url: "https://example.com", title: "Example" };
  }
  async openTab(_url: string): Promise<number> {
    return 1;
  }
  async navigateTo(_tabId: number, _url: string): Promise<Result<NavigationResult, BrowserError>> {
    throw new Error("unused");
  }
  async captureScreenshot(): Promise<string> {
    return "";
  }
  onTabActivated(_callback: (tabId: number) => void): () => void {
    return () => {};
  }
  onTabUpdated(_callback: (tabId: number, url: string) => void): () => void {
    return () => {};
  }
  onTabRemoved(_callback: (tabId: number) => void): () => void {
    return () => {};
  }
  async readPageContent(
    _tabId: number,
    _maxDepth?: number,
  ): Promise<Result<PageContent, BrowserError>> {
    throw new Error("unused");
  }
  async executeScript(
    _tabId: number,
    _code: string,
    _signal?: AbortSignal,
  ): Promise<Result<ScriptResult, ToolError>> {
    throw new Error("unused");
  }
  async injectElementPicker(
    _tabId: number,
    _message?: string,
  ): Promise<Result<ElementInfo | null, BrowserError>> {
    throw new Error("unused");
  }
}

class NoopSessionStorage implements SessionStoragePort {
  async listSessions() {
    return [];
  }
  async getMetadata() {
    return null;
  }
  async getLatestSessionId() {
    return null;
  }
  async getSession() {
    return null;
  }
  async saveSession() {}
  async updateTitle() {}
  async deleteSession() {}
}

function createDeps(storage: InMemoryStorage): AppDeps {
  return {
    createAIProvider: () => new NoopAIProvider(),
    authProviders: {},
    browserExecutor: new NoopBrowserExecutor(),
    storage,
    sessionStorage: new NoopSessionStorage(),
    artifactStorage: new InMemoryArtifactStorage(),
  };
}

describe("initializeApp", () => {
  beforeEach(() => {
    initStore(new InMemoryArtifactStorage());
    useStore.setState(useStore.getInitialState());
  });

  it("読み込んだ settings を副作用なしで復元する", async () => {
    const storage = new InMemoryStorage();
    const loadedSettings = {
      provider: "openai" as const,
      model: "gpt-4.1",
      apiKey: "sk-test",
      baseUrl: "",
      apiMode: "auto" as const,
      enterpriseDomain: "",
      credentials: null,
      credentialsByProvider: {},
      apiKeyByProvider: { openai: "sk-test" },
      baseUrlByProvider: { openai: "" },
      apiModeByProvider: { openai: "auto" },
      modelByProvider: { openai: "gpt-4.1" },
      reasoningLevelByProvider: { openai: "high" as const },
      maxTokensByProvider: { openai: 8192 },
      reasoningLevel: "high" as const,
      maxTokens: 8192,
      enableMcpServer: false,
      enableBgFetch: false,
    };
    await storage.set("sitesurf_settings", loadedSettings);

    await initializeApp(createDeps(storage), 1);

    expect(useStore.getState().settings).toEqual(loadedSettings);
  });
});
