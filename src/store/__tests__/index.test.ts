import { describe, expect, it, beforeEach } from "vitest";
import { useStore, initStore } from "../index";
import type { AIMessage } from "@/ports/ai-provider";
import { ok, err } from "@/shared/errors";
import type { ToolError } from "@/shared/errors";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";

const mockArtifactStorage: ArtifactStoragePort & { setSessionId(id: string | null): void } = {
  put: async () => {},
  get: async () => null,
  list: async () => [],
  delete: async () => {},
  clearAll: async () => {},
  setSessionId: () => {},
};

function resetStore() {
  initStore(mockArtifactStorage);
  useStore.setState(useStore.getInitialState());
}

function userMsg(text: string): AIMessage {
  return { role: "user", content: [{ type: "text", text }] };
}

function assistantMsg(text: string): AIMessage {
  return { role: "assistant", content: [{ type: "text", text }] };
}

describe("AppStore", () => {
  beforeEach(() => {
    initStore(mockArtifactStorage);
    resetStore();
  });

  describe("ChatSlice", () => {
    it("初期状態は空", () => {
      const s = useStore.getState();
      expect(s.messages).toStrictEqual([]);
      expect(s.history).toStrictEqual([]);
      expect(s.isStreaming).toBe(false);
      expect(s.abortController).toBeNull();
    });

    it("addUserMessage でユーザーメッセージを追加できる", () => {
      useStore.getState().addUserMessage("hello");
      const msgs = useStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe("user");
      expect(msgs[0].content).toBe("hello");
      expect(msgs[0].id).toBeTruthy();
      expect(msgs[0].timestamp).toBeGreaterThan(0);
    });

    it("addUserMessage で画像付きメッセージを追加できる", () => {
      useStore.getState().addUserMessage("with image", "base64data");
      const msgs = useStore.getState().messages;
      expect(msgs[0].image).toBe("base64data");
    });

    it("startNewAssistantMessage で空のアシスタントメッセージを追加する", () => {
      useStore.getState().startNewAssistantMessage();
      const msgs = useStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe("assistant");
      expect(msgs[0].content).toBe("");
      expect(msgs[0].toolCalls).toStrictEqual([]);
    });

    it("appendDelta で最後のアシスタントメッセージにテキストを追記する", () => {
      useStore.getState().startNewAssistantMessage();
      useStore.getState().appendDelta("Hello");
      useStore.getState().appendDelta(" World");
      expect(useStore.getState().messages[0].content).toBe("Hello World");
    });

    it("appendDelta はアシスタントメッセージがない場合何もしない", () => {
      useStore.getState().addUserMessage("user msg");
      useStore.getState().appendDelta("delta");
      expect(useStore.getState().messages).toHaveLength(1);
      expect(useStore.getState().messages[0].content).toBe("user msg");
    });

    it("clearLastAssistantMessage で最後のアシスタントメッセージをクリアする", () => {
      useStore.getState().startNewAssistantMessage();
      useStore.getState().appendDelta("some text");
      useStore.getState().addToolCall({
        id: "tc1",
        name: "test",
        args: {},
        isRunning: false,
      });
      useStore.getState().clearLastAssistantMessage();
      const msg = useStore.getState().messages[0];
      expect(msg.content).toBe("");
      expect(msg.toolCalls).toStrictEqual([]);
    });

    it("addToolCall で最後のアシスタントメッセージにツール呼出しを追加する", () => {
      useStore.getState().startNewAssistantMessage();
      useStore.getState().addToolCall({
        id: "tc1",
        name: "read_page",
        args: { selector: "body" },
        isRunning: true,
      });
      const tcs = useStore.getState().messages[0].toolCalls;
      expect(tcs).toHaveLength(1);
      expect(tcs![0].name).toBe("read_page");
      expect(tcs![0].isRunning).toBe(true);
    });

    it("updateToolCallResult で成功結果を更新する", () => {
      useStore.getState().startNewAssistantMessage();
      useStore.getState().addToolCall({
        id: "tc1",
        name: "test",
        args: {},
        isRunning: true,
      });
      useStore.getState().updateToolCallResult("tc1", ok("result data"));
      const tc = useStore.getState().messages[0].toolCalls![0];
      expect(tc.success).toBe(true);
      expect(tc.isRunning).toBe(false);
      expect(tc.result).toBe('"result data"');
    });

    it("updateToolCallResult でエラー結果を更新する", () => {
      useStore.getState().startNewAssistantMessage();
      useStore.getState().addToolCall({
        id: "tc1",
        name: "test",
        args: {},
        isRunning: true,
      });
      const toolErr: ToolError = {
        code: "tool_timeout",
        message: "Timed out",
      };
      useStore.getState().updateToolCallResult("tc1", err(toolErr));
      const tc = useStore.getState().messages[0].toolCalls![0];
      expect(tc.success).toBe(false);
      expect(tc.result).toBe("Timed out");
    });

    it("addSystemMessage でシステムメッセージを追加する", () => {
      useStore.getState().addSystemMessage("system info");
      const msg = useStore.getState().messages[0];
      expect(msg.role).toBe("system");
      expect(msg.content).toBe("system info");
    });

    it("addNavigationMessage でナビゲーションメッセージを追加する", () => {
      useStore.getState().addNavigationMessage({
        url: "https://example.com",
        title: "Example",
        favicon: "icon.png",
      });
      const msg = useStore.getState().messages[0];
      expect(msg.role).toBe("navigation");
      expect(msg.url).toBe("https://example.com");
      expect(msg.favicon).toBe("icon.png");
    });

    it("addErrorMessage でエラーメッセージを追加する", () => {
      useStore.getState().addErrorMessage({
        code: "ai_network",
        message: "Network error",
      });
      const msg = useStore.getState().messages[0];
      expect(msg.role).toBe("error");
      expect(msg.errorCode).toBe("ai_network");
    });

    it("syncHistory で履歴を置き換える", () => {
      useStore.getState().pushHistory(userMsg("old"));
      useStore.getState().syncHistory([userMsg("new")]);
      expect(useStore.getState().history).toHaveLength(1);
      expect(
        (
          useStore.getState().history[0] as {
            role: "user";
            content: { type: "text"; text: string }[];
          }
        ).content[0].text,
      ).toBe("new");
    });

    it("pushHistory で履歴に追加する", () => {
      useStore.getState().pushHistory(userMsg("msg1"));
      useStore.getState().pushHistory(assistantMsg("msg2"));
      expect(useStore.getState().history).toHaveLength(2);
    });

    it("setStreaming で AbortController を生成・破棄する", () => {
      useStore.getState().setStreaming(true);
      expect(useStore.getState().isStreaming).toBe(true);
      expect(useStore.getState().abortController).toBeInstanceOf(AbortController);

      useStore.getState().setStreaming(false);
      expect(useStore.getState().isStreaming).toBe(false);
      expect(useStore.getState().abortController).toBeNull();
    });

    it("getAbortSignal でシグナルを取得できる", () => {
      useStore.getState().setStreaming(true);
      const signal = useStore.getState().getAbortSignal();
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it("clearAll でメッセージと履歴をクリアする", () => {
      useStore.getState().addUserMessage("test");
      useStore.getState().pushHistory(userMsg("test"));
      useStore.getState().clearAll();
      expect(useStore.getState().messages).toStrictEqual([]);
      expect(useStore.getState().history).toStrictEqual([]);
    });
  });

  describe("SettingsSlice", () => {
    it("初期設定が正しい", () => {
      const s = useStore.getState().settings;
      expect(s.provider).toBe("anthropic");
      expect(s.model).toBe("");
      expect(s.apiKey).toBe("");
      expect(s.baseUrl).toBe("");
      expect(s.enterpriseDomain).toBe("");
      expect(s.credentials).toBeNull();
    });

    it("setSettings で部分的に更新できる", () => {
      useStore.getState().setSettings({ provider: "openai", model: "gpt-4o" });
      const s = useStore.getState().settings;
      expect(s.provider).toBe("openai");
      expect(s.model).toBe("gpt-4o");
      expect(s.apiKey).toBe("");
    });

    it("setCredentials で認証情報を設定できる", () => {
      const creds = {
        providerId: "openai" as const,
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: Date.now() + 3600000,
        metadata: {},
      };
      useStore.getState().setCredentials(creds);
      expect(useStore.getState().settings.credentials).toStrictEqual(creds);
    });

    it("setCredentials(null) で認証情報をクリアできる", () => {
      useStore.getState().setCredentials({
        providerId: "openai",
        accessToken: "t",
        refreshToken: "r",
        expiresAt: 0,
        metadata: {},
      });
      useStore.getState().setCredentials(null);
      expect(useStore.getState().settings.credentials).toBeNull();
    });

    it("model・reasoningLevel・maxTokens を現在 provider の map に保存する", () => {
      useStore.getState().setSettings({
        model: "claude-opus-4-1",
        reasoningLevel: "high",
        maxTokens: 32768,
      });

      const s = useStore.getState().settings;
      expect(s.model).toBe("claude-opus-4-1");
      expect(s.reasoningLevel).toBe("high");
      expect(s.maxTokens).toBe(32768);
      expect(s.modelByProvider).toEqual({ anthropic: "claude-opus-4-1" });
      expect(s.reasoningLevelByProvider).toEqual({ anthropic: "high" });
      expect(s.maxTokensByProvider).toEqual({ anthropic: 32768 });
    });

    it("provider 切替時に保存済みの provider 別設定を復元する", () => {
      useStore.getState().setSettings({
        provider: "openai",
        model: "gpt-4o",
        reasoningLevel: "low",
        maxTokens: 4096,
      });
      useStore
        .getState()
        .setSettings({ model: "gpt-4.1", reasoningLevel: "high", maxTokens: 8192 });

      useStore.getState().setSettings({
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        reasoningLevel: "medium",
        maxTokens: 16384,
      });
      useStore.getState().setSettings({
        model: "claude-opus-4-1",
        reasoningLevel: "none",
        maxTokens: 32768,
      });

      useStore.getState().setSettings({ provider: "openai", model: "gpt-5.4" });

      const s = useStore.getState().settings;
      expect(s.provider).toBe("openai");
      expect(s.model).toBe("gpt-4.1");
      expect(s.reasoningLevel).toBe("high");
      expect(s.maxTokens).toBe(8192);
    });

    it("未設定の provider に切り替えたときは標準の既定値にフォールバックする", () => {
      useStore.getState().setSettings({
        model: "claude-opus-4-1",
        reasoningLevel: "high",
        maxTokens: 32768,
      });

      useStore.getState().setSettings({ provider: "google" });

      const s = useStore.getState().settings;
      expect(s.provider).toBe("google");
      expect(s.model).toBe("gemini-2.5-flash");
      expect(s.reasoningLevel).toBe("medium");
      expect(s.maxTokens).toBe(DEFAULT_MAX_TOKENS);
    });

    it("空文字 model を保存した provider へ戻っても default model を使う", () => {
      useStore.getState().setSettings({ provider: "openai", model: "gpt-4.1" });
      useStore.getState().setSettings({ provider: "anthropic" });

      const s = useStore.getState().settings;
      expect(s.provider).toBe("anthropic");
      expect(s.model).toBe("claude-sonnet-4-6");
    });

    it("同一 provider で model を空文字にしても runtime snapshot は default model を使う", () => {
      useStore.getState().setSettings({ model: "" });

      const s = useStore.getState().settings;
      expect(s.provider).toBe("anthropic");
      expect(s.model).toBe("claude-sonnet-4-6");
    });

    it("provider 切替と同時に渡した auth 系 partial を切替先に反映する", () => {
      useStore.getState().setSettings({
        provider: "openai",
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        apiMode: "responses",
      });

      const s = useStore.getState().settings;
      expect(s.provider).toBe("openai");
      expect(s.apiKey).toBe("sk-test");
      expect(s.baseUrl).toBe("https://example.com/v1");
      expect(s.apiMode).toBe("responses");
      expect(s.apiKeyByProvider).toEqual({ anthropic: "", openai: "sk-test" });
      expect(s.baseUrlByProvider).toEqual({ anthropic: "", openai: "https://example.com/v1" });
      expect(s.apiModeByProvider).toEqual({ anthropic: "auto", openai: "responses" });
    });

    it("hydrateSettings は読み込んだ settings を副作用なしでそのまま復元する", () => {
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
        baseUrlByProvider: {},
        apiModeByProvider: {},
        modelByProvider: { openai: "gpt-4.1" },
        reasoningLevelByProvider: { openai: "high" as const },
        maxTokensByProvider: { openai: 8192 },
        reasoningLevel: "high" as const,
        maxTokens: 8192,
        autoCompact: false,
        enableBgFetch: false,
        enableSecurityMiddleware: true,
      };

      useStore.getState().hydrateSettings(loadedSettings);

      expect(useStore.getState().settings).toEqual(loadedSettings);
    });
  });

  describe("SessionSlice", () => {
    it("初期状態が正しい", () => {
      const s = useStore.getState();
      expect(s.sessionList).toStrictEqual([]);
      expect(s.activeSessionId).toBeNull();
      expect(s.activeSessionSnapshot).toBeNull();
      expect(s.sessionLoading).toBe(false);
    });

    it("setSessionList でセッション一覧を設定できる", () => {
      const list = [
        {
          id: "s1",
          title: "Session 1",
          createdAt: "2025-01-01T00:00:00.000Z",
          lastModified: "2025-01-01T00:00:00.000Z",
          messageCount: 5,
          modelId: "claude-sonnet-4-20250514",
          preview: "",
        },
      ];
      useStore.getState().setSessionList(list);
      expect(useStore.getState().sessionList).toStrictEqual(list);
    });

    it("setActiveSession でセッションとIDを同時に設定する", () => {
      const session = {
        id: "s1",
        title: "Test",
        messages: [],
        history: [],
        createdAt: "2025-01-01T00:00:00.000Z",
        model: "claude-sonnet-4-20250514",
      };
      useStore.getState().setActiveSession(session);
      expect(useStore.getState().activeSessionId).toBe("s1");
      expect(useStore.getState().activeSessionSnapshot).toStrictEqual(session);
    });

    it("loadSession でセッションを読み込みメッセージ・履歴も復元する", () => {
      const msg = {
        id: "m1",
        role: "user" as const,
        content: "hello",
        timestamp: 1000,
      };
      const hist: AIMessage = userMsg("hello");
      const session = {
        id: "s1",
        title: "Test",
        messages: [msg],
        history: [hist],
        createdAt: "2025-01-01T00:00:00.000Z",
        model: "claude-sonnet-4-20250514",
      };
      useStore.getState().loadSession(session);
      expect(useStore.getState().messages).toStrictEqual([msg]);
      expect(useStore.getState().history).toStrictEqual([hist]);
      expect(useStore.getState().activeSessionId).toBe("s1");
    });

    it("setSessionLoading でローディング状態を設定できる", () => {
      useStore.getState().setSessionLoading(true);
      expect(useStore.getState().sessionLoading).toBe(true);
    });
  });

  describe("UISlice", () => {
    it("初期状態が正しい", () => {
      const s = useStore.getState();
      expect(s.settingsOpen).toBe(false);
      expect(s.currentTab).toStrictEqual({ id: null, url: "", title: "" });
      expect(s.pendingScreenshot).toBeNull();
      expect(s.theme).toBe("auto");
    });

    it("setSettingsOpen で設定パネルの開閉を制御する", () => {
      useStore.getState().setSettingsOpen(true);
      expect(useStore.getState().settingsOpen).toBe(true);
    });

    it("toggleSettings で設定パネルをトグルする", () => {
      useStore.getState().toggleSettings();
      expect(useStore.getState().settingsOpen).toBe(true);
      useStore.getState().toggleSettings();
      expect(useStore.getState().settingsOpen).toBe(false);
    });

    it("setTab でタブ情報を設定する", () => {
      useStore.getState().setTab({ id: 1, url: "https://example.com", title: "Example" });
      expect(useStore.getState().currentTab.url).toBe("https://example.com");
    });

    it("setPendingScreenshot でスクリーンショットを設定・クリアする", () => {
      useStore.getState().setPendingScreenshot("base64data");
      expect(useStore.getState().pendingScreenshot).toBe("base64data");
      useStore.getState().setPendingScreenshot(null);
      expect(useStore.getState().pendingScreenshot).toBeNull();
    });

    it("setTheme でテーマを変更する", () => {
      useStore.getState().setTheme("dark");
      expect(useStore.getState().theme).toBe("dark");
    });
  });

  describe("Slice間のアクセス", () => {
    it("useStore から全4 slice のstateにアクセスできる", () => {
      const s = useStore.getState();
      expect(s.messages).toBeDefined();
      expect(s.history).toBeDefined();
      expect(s.isStreaming).toBeDefined();
      expect(s.settings).toBeDefined();
      expect(s.sessionList).toBeDefined();
      expect(s.activeSessionId).toBeDefined();
      expect(s.settingsOpen).toBeDefined();
      expect(s.currentTab).toBeDefined();
      expect(s.theme).toBeDefined();
    });

    it("useStore から全4 slice のactionにアクセスできる", () => {
      const s = useStore.getState();
      expect(typeof s.addUserMessage).toBe("function");
      expect(typeof s.appendDelta).toBe("function");
      expect(typeof s.clearAll).toBe("function");
      expect(typeof s.setSettings).toBe("function");
      expect(typeof s.setCredentials).toBe("function");
      expect(typeof s.setSessionList).toBe("function");
      expect(typeof s.loadSession).toBe("function");
      expect(typeof s.toggleSettings).toBe("function");
      expect(typeof s.setTab).toBe("function");
    });
  });
});
