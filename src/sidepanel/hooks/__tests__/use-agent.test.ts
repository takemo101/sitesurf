// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgent } from "../use-agent";
import { DepsProvider, type AppDeps } from "@/shared/deps-context";
import { initStore, useStore } from "@/store";
import { InMemoryArtifactStorage, InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import { SkillRegistry } from "@/shared/skill-registry";
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

const runAgentLoopMock = vi.fn<(params: unknown) => Promise<void>>(() => Promise.resolve());

vi.mock("@/orchestration/agent-loop", () => ({
  runAgentLoop: (params: unknown) => runAgentLoopMock(params),
}));

vi.mock("@/features/tools", () => ({
  AGENT_TOOL_DEFS: [],
  getAgentToolDefs: vi.fn(() => []),
  createToolExecutorWithSkills: vi.fn(() => vi.fn()),
  loadSkillRegistry: vi.fn(async () => new SkillRegistry()),
}));

vi.mock("@/features/sessions/auto-save", () => ({
  createAutoSaver: vi.fn(() => ({ saveImmediately: vi.fn() })),
}));

vi.mock("@/features/settings/skill-registry-sync", () => ({
  subscribeSkillRegistryReload: vi.fn(() => () => {}),
}));

vi.mock("@/features/ai/system-prompt-v2", () => ({
  getSystemPromptV2: vi.fn(() => "system-prompt"),
}));

vi.mock("@/shared/utils", () => ({
  isExcludedUrl: vi.fn(() => false),
  getLastKnownUrl: vi.fn(() => null),
}));

vi.mock("@/features/security/audit-logger", () => ({
  createStorageBackedSecurityAuditLogger: vi.fn(() => ({})),
}));

vi.mock("@/features/security/middleware", () => ({
  createSecurityMiddleware: vi.fn(() => ({})),
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

describe("useAgent", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    runAgentLoopMock.mockClear();
    initStore(new InMemoryArtifactStorage());
    useStore.setState(useStore.getInitialState());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("handleSend は maxTokens を agent loop に渡す", async () => {
    const storage = new InMemoryStorage();
    const deps = createDeps(storage);
    let agent: ReturnType<typeof useAgent> | null = null;

    function TestComponent() {
      agent = useAgent();
      return null;
    }

    useStore.getState().setSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "sk-test",
      maxTokens: 12345,
    });

    await act(async () => {
      root.render(createElement(DepsProvider, { value: deps }, createElement(TestComponent)));
    });

    await act(async () => {
      await agent?.handleSend("hello");
    });

    expect(runAgentLoopMock).toHaveBeenCalledTimes(1);
    const [firstCall] = runAgentLoopMock.mock.calls;
    expect(firstCall?.[0]).toMatchObject({
      settings: {
        provider: "openai",
        model: "gpt-4.1",
        maxTokens: 12345,
      },
    });
  });
});
