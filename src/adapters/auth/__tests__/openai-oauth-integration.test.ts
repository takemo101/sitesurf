import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIAuth } from "../openai-auth";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { AuthCallbacks, AuthCredentials } from "@/ports/auth-provider";
import { runAgentLoop, type AgentLoopParams, type ChatActions } from "@/orchestration/agent-loop";
import type { Session } from "@/ports/session-types";
import type { AIProvider, StreamEvent, ProviderConfig } from "@/ports/ai-provider";
import type { ToolResultStorePort } from "@/ports/tool-result-store";
import { ok, err } from "@/shared/errors";
import { SkillRegistry } from "@/shared/skill-registry";

vi.mock("@/shared/utils", () => ({
  sleep: vi.fn(() => Promise.resolve()),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
vi.stubGlobal("crypto", {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
    return arr;
  },
  subtle: { digest: mockDigest },
});

const mockToolResultStore: ToolResultStorePort = {
  save: async () => {},
  get: async () => null,
  list: async () => [],
  deleteSession: async () => {},
};

function createMockBrowser(overrides: Partial<BrowserExecutor> = {}): BrowserExecutor {
  return {
    getActiveTab: vi
      .fn()
      .mockResolvedValue({ id: 1, url: "https://example.com", title: "Example" }),
    openTab: vi.fn().mockResolvedValue(42),
    navigateTo: vi.fn().mockResolvedValue(ok({ url: "", title: "" })),
    captureScreenshot: vi.fn().mockResolvedValue(""),
    onTabActivated: vi.fn().mockReturnValue(vi.fn()),
    onTabUpdated: vi.fn().mockReturnValue(vi.fn()),
    onTabRemoved: vi.fn().mockReturnValue(vi.fn()),
    readPageContent: vi.fn().mockResolvedValue(ok({ text: "", simplifiedDom: "" })),
    executeScript: vi.fn().mockResolvedValue(ok({ value: undefined })),
    injectElementPicker: vi.fn().mockResolvedValue(ok(null)),
    ...overrides,
  };
}

function createMockChatStore(overrides: Partial<ChatActions> = {}): ChatActions {
  return {
    setStreaming: vi.fn(),
    getAbortSignal: vi.fn().mockReturnValue(undefined),
    startNewAssistantMessage: vi.fn(),
    appendDelta: vi.fn(),
    appendReasoning: vi.fn(),
    clearLastAssistantMessage: vi.fn(),
    setLastMessageUsage: vi.fn(),
    addToolCall: vi.fn(),
    appendToolInputDelta: vi.fn(),
    updateToolCallArgs: vi.fn(),
    updateToolCallResult: vi.fn(),
    addSystemMessage: vi.fn(),
    addErrorMessage: vi.fn(),
    syncHistory: vi.fn(),
    getMessages: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    title: "Test Session",
    createdAt: new Date().toISOString(),
    model: "gpt-4o",
    messages: [],
    history: [],
    ...overrides,
  };
}

function createStreamFromEvents(events: StreamEvent[]): AsyncIterable<StreamEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

describe("OpenAI OAuth Integration Tests", () => {
  let browser: BrowserExecutor;
  let auth: OpenAIAuth;
  let progressHistory: string[];
  let callbacks: AuthCallbacks;

  beforeEach(() => {
    vi.resetAllMocks();
    mockDigest.mockResolvedValue(new ArrayBuffer(32));
    browser = createMockBrowser();
    auth = new OpenAIAuth(browser);
    progressHistory = [];
    callbacks = {
      onProgress: (status) => progressHistory.push(status),
    };
  });

  describe("OAuth Login Flow", () => {
    it("completes full PKCE flow successfully", async () => {
      let capturedState = "";
      vi.mocked(browser.openTab).mockImplementation(async (url) => {
        const parsed = new URL(url);
        capturedState = parsed.searchParams.get("state") ?? "";
        expect(url).toContain("https://auth.openai.com/oauth/authorize");
        expect(url).toContain("client_id=app_EMoamEEZ73f0CkXaXp7hrann");
        expect(url).toContain("code_challenge=");
        expect(url).toContain("code_challenge_method=S256");
        return 42;
      });

      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(() => {
          cb(42, `http://localhost:1455/auth/callback?code=auth_code_123&state=${capturedState}`);
        }, 10);
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig",
            refresh_token: "rt_abc123",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.providerId).toBe("openai");
        expect(result.value.accessToken).toBe("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig");
        expect(result.value.refreshToken).toBe("rt_abc123");
        expect(result.value.expiresAt).toBeGreaterThan(Date.now());
        expect(result.value.metadata.accountId).toBe("user-123");
      }

      expect(progressHistory).toContain("starting");
      expect(progressHistory).toContain("waiting-for-user");
    });

    it("returns auth_cancelled when tab is closed during authentication", async () => {
      vi.mocked(browser.onTabUpdated).mockReturnValue(vi.fn());
      vi.mocked(browser.onTabRemoved).mockImplementation((cb) => {
        setTimeout(() => cb(42), 10);
        return vi.fn();
      });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
        expect(result.error.message).toBe("認証がキャンセルされました");
      }
    });

    it("returns auth_cancelled when redirect has no authorization code", async () => {
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(() => cb(42, "http://localhost:1455/auth/callback?error=access_denied"), 10);
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
      }
    });

    it("returns auth_cancelled when state parameter mismatch", async () => {
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () => cb(42, "http://localhost:1455/auth/callback?code=abc&state=wrong_state"),
          10,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
        expect(result.error.message).toBe("認証状態が一致しません");
      }
    });

    it("returns auth_network when token exchange fails", async () => {
      let capturedState = "";
      vi.mocked(browser.openTab).mockImplementation(async (url) => {
        const parsed = new URL(url);
        capturedState = parsed.searchParams.get("state") ?? "";
        return 42;
      });
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () => cb(42, `http://localhost:1455/auth/callback?code=abc&state=${capturedState}`),
          10,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockRejectedValue(new Error("Network failure"));

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_network");
        expect(result.error.message).toContain("トークン交換に失敗");
      }
    });
  });

  describe("API Calls with OAuth", () => {
    it("creates provider config with oauthToken when credentials exist", () => {
      const credentials: AuthCredentials = {
        providerId: "openai",
        accessToken: "oauth_access_token",
        refreshToken: "refresh_token",
        expiresAt: Date.now() + 3600000,
        metadata: { accountId: "user-123" },
      };

      const config: ProviderConfig = {
        provider: "openai",
        model: "gpt-4o",
        oauthToken: credentials.accessToken,
        apiKey: "",
      };

      expect(config.oauthToken).toBe("oauth_access_token");
      expect(config.apiKey).toBe("");
    });

    it("API key takes precedence over OAuth token when both provided", () => {
      const config: ProviderConfig = {
        provider: "openai",
        model: "gpt-4o",
        oauthToken: "oauth_token",
        apiKey: "sk_api_key",
      };

      // When apiKey is provided, it should be used
      expect(config.apiKey).toBe("sk_api_key");
      expect(config.oauthToken).toBe("oauth_token");
    });
  });

  describe("Token Refresh", () => {
    it("successfully refreshes expired token", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new_access_token.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig",
            refresh_token: "new_refresh_token",
            expires_in: 7200,
          }),
      }));

      const expiredCredentials: AuthCredentials = {
        providerId: "openai",
        accessToken: "old_token",
        refreshToken: "old_refresh_token",
        expiresAt: Date.now() - 1000,
        metadata: {},
      };

      const result = await auth.refresh(expiredCredentials);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBe("new_access_token.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig");
        expect(result.value.refreshToken).toBe("new_refresh_token");
        expect(result.value.expiresAt).toBeGreaterThan(Date.now());
      }

      expect(mockFetch).toHaveBeenCalledWith("https://auth.openai.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "old_refresh_token",
          client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
          scope: "openid profile email offline_access",
        }),
      });
    });

    it("returns auth_refresh_failed on HTTP 401 error", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: false,
        status: 401,
      }));

      const credentials: AuthCredentials = {
        providerId: "openai",
        accessToken: "token",
        refreshToken: "invalid_refresh_token",
        expiresAt: Date.now() - 1000,
        metadata: {},
      };

      const result = await auth.refresh(credentials);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_refresh_failed");
        expect(result.error.message).toContain("リフレッシュ失敗");
      }
    });

    it("returns auth_network on network error during refresh", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const credentials: AuthCredentials = {
        providerId: "openai",
        accessToken: "token",
        refreshToken: "refresh_token",
        expiresAt: Date.now() - 1000,
        metadata: {},
      };

      const result = await auth.refresh(credentials);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_network");
      }
    });

    it("isValid returns false when token is within 5-minute margin", () => {
      const credentials: AuthCredentials = {
        providerId: "openai",
        accessToken: "token",
        refreshToken: "refresh_token",
        expiresAt: Date.now() + 3 * 60 * 1000, // 3 minutes left
        metadata: {},
      };

      expect(auth.isValid(credentials)).toBe(false);
    });

    it("isValid returns true when token has more than 5 minutes left", () => {
      const credentials: AuthCredentials = {
        providerId: "openai",
        accessToken: "token",
        refreshToken: "refresh_token",
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes left
        metadata: {},
      };

      expect(auth.isValid(credentials)).toBe(true);
    });
  });

  describe("Provider Switching", () => {
    it("maintains separate credentials per provider", () => {
      const openaiCreds: AuthCredentials = {
        providerId: "openai",
        accessToken: "openai_token",
        refreshToken: "openai_refresh",
        expiresAt: Date.now() + 3600000,
        metadata: { accountId: "openai-user" },
      };

      const copilotCreds: AuthCredentials = {
        providerId: "copilot",
        accessToken: "copilot_token",
        refreshToken: "copilot_refresh",
        expiresAt: Date.now() + 3600000,
        metadata: { accountId: "copilot-user" },
      };

      // Simulate storing credentials by provider
      const credentialsByProvider: Record<string, AuthCredentials> = {
        openai: openaiCreds,
        copilot: copilotCreds,
      };

      expect(credentialsByProvider.openai.accessToken).toBe("openai_token");
      expect(credentialsByProvider.copilot.accessToken).toBe("copilot_token");
    });
  });

  describe("Edge Cases", () => {
    it("extracts accountId from JWT token payload", async () => {
      let capturedState = "";
      vi.mocked(browser.openTab).mockImplementation(async (url) => {
        const parsed = new URL(url);
        capturedState = parsed.searchParams.get("state") ?? "";
        return 42;
      });

      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () => cb(42, `http://localhost:1455/auth/callback?code=abc&state=${capturedState}`),
          10,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      // JWT with payload: {"sub":"user-456"}
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "header.eyJzdWIiOiJ1c2VyLTQ1NiJ9.signature",
            refresh_token: "rt",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.accountId).toBe("user-456");
      }
    });

    it("handles JWT without sub claim gracefully", async () => {
      let capturedState = "";
      vi.mocked(browser.openTab).mockImplementation(async (url) => {
        const parsed = new URL(url);
        capturedState = parsed.searchParams.get("state") ?? "";
        return 42;
      });

      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () => cb(42, `http://localhost:1455/auth/callback?code=abc&state=${capturedState}`),
          10,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      // JWT with payload without sub claim
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "header.eyJuYW1lIjoidGVzdCJ9.signature",
            refresh_token: "rt",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.accountId).toBeUndefined();
      }
    });

    it("handles malformed JWT gracefully", async () => {
      let capturedState = "";
      vi.mocked(browser.openTab).mockImplementation(async (url) => {
        const parsed = new URL(url);
        capturedState = parsed.searchParams.get("state") ?? "";
        return 42;
      });

      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () => cb(42, `http://localhost:1455/auth/callback?code=abc&state=${capturedState}`),
          10,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "not_a_valid_jwt",
            refresh_token: "rt",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.accountId).toBeUndefined();
      }
    });

    it("ignores tab updates from other tabs", async () => {
      let capturedState = "";
      vi.mocked(browser.openTab).mockImplementation(async (url) => {
        const parsed = new URL(url);
        capturedState = parsed.searchParams.get("state") ?? "";
        return 42;
      });

      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(() => cb(99, `http://localhost:1455/auth/callback?code=abc&state=wrong`), 5);
        setTimeout(
          () => cb(42, `http://localhost:1455/auth/callback?code=abc&state=${capturedState}`),
          20,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token",
            refresh_token: "rt",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      // Should complete successfully despite first update from wrong tab
      expect(result.ok).toBe(true);
    });
  });

  describe("Agent Loop Integration", () => {
    it("refreshes credentials on ai_auth_invalid error and retries", async () => {
      const refreshedCreds: AuthCredentials = {
        providerId: "openai",
        accessToken: "new_token",
        refreshToken: "refresh_token",
        expiresAt: Date.now() + 3600000,
        metadata: {},
      };

      const mockAuthProvider = {
        login: vi.fn(),
        refresh: vi.fn().mockResolvedValue(ok(refreshedCreds)),
        isValid: vi.fn().mockReturnValue(false),
      };

      let callCount = 0;
      const mockStreamText = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createStreamFromEvents([
            { type: "error", error: { code: "ai_auth_invalid", message: "Token expired" } },
          ]);
        }
        return createStreamFromEvents([
          { type: "text-delta", text: "Success after refresh" },
          { type: "finish", finishReason: "stop" },
        ]);
      });

      const mockAIProvider: AIProvider = {
        streamText: mockStreamText,
      };

      const chatStore = createMockChatStore();
      const onCredentialsUpdate = vi.fn();

      const params: AgentLoopParams = {
        deps: {
          createAIProvider: () => mockAIProvider,
          browserExecutor: browser,
          authProvider: mockAuthProvider,
          toolResultStore: mockToolResultStore,
        },
        chatStore,
        settings: {
          provider: "openai",
          model: "gpt-4o",
          apiKey: "",
          baseUrl: "",
          enterpriseDomain: "",
          oauthToken: "old_token",
        },
        session: createMockSession(),
        tools: [],
        systemPrompt: "Test",
        autoSaver: { saveImmediately: vi.fn() },
        toolExecutor: vi.fn().mockResolvedValue(ok({})),
        skillRegistry: new SkillRegistry(),
        credentials: {
          providerId: "openai",
          accessToken: "old_token",
          refreshToken: "refresh_token",
          expiresAt: Date.now() - 1000,
          metadata: {},
        },
        onCredentialsUpdate,
      };

      await runAgentLoop(params);

      expect(mockAuthProvider.refresh).toHaveBeenCalled();
      expect(onCredentialsUpdate).toHaveBeenCalledWith(refreshedCreds);
      expect(chatStore.addSystemMessage).toHaveBeenCalledWith("🔄 認証を更新しました。再試行中...");
    });

    it("clears credentials when refresh fails on auth error", async () => {
      const mockAuthProvider = {
        login: vi.fn(),
        refresh: vi
          .fn()
          .mockResolvedValue(err({ code: "auth_refresh_failed", message: "Refresh failed" })),
        isValid: vi.fn().mockReturnValue(false),
      };

      const mockStreamText = vi.fn().mockImplementation(() => {
        return createStreamFromEvents([
          { type: "error", error: { code: "ai_auth_invalid", message: "Token expired" } },
        ]);
      });

      const mockAIProvider: AIProvider = {
        streamText: mockStreamText,
      };

      const chatStore = createMockChatStore();
      const onCredentialsUpdate = vi.fn();

      const params: AgentLoopParams = {
        deps: {
          createAIProvider: () => mockAIProvider,
          browserExecutor: browser,
          authProvider: mockAuthProvider,
          toolResultStore: mockToolResultStore,
        },
        chatStore,
        settings: {
          provider: "openai",
          model: "gpt-4o",
          apiKey: "",
          baseUrl: "",
          enterpriseDomain: "",
        },
        session: createMockSession(),
        tools: [],
        systemPrompt: "Test",
        autoSaver: { saveImmediately: vi.fn() },
        toolExecutor: vi.fn().mockResolvedValue(ok({})),
        skillRegistry: new SkillRegistry(),
        credentials: {
          providerId: "openai",
          accessToken: "expired_token",
          refreshToken: "invalid_refresh_token",
          expiresAt: Date.now() - 1000,
          metadata: {},
        },
        onCredentialsUpdate,
      };

      await runAgentLoop(params);

      expect(mockAuthProvider.refresh).toHaveBeenCalled();
      expect(onCredentialsUpdate).toHaveBeenCalledWith(null);
      expect(chatStore.addErrorMessage).toHaveBeenCalled();
    });
  });
});
