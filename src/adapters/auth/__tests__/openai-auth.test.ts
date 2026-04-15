import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIAuth } from "../openai-auth";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { AuthCallbacks } from "@/ports/auth-provider";

function createMockBrowser(): BrowserExecutor {
  return {
    getActiveTab: vi.fn(),
    openTab: vi.fn().mockResolvedValue(42),
    navigateTo: vi.fn(),
    captureScreenshot: vi.fn(),
    onTabActivated: vi.fn().mockReturnValue(vi.fn()),
    onTabUpdated: vi.fn().mockReturnValue(vi.fn()),
    onTabRemoved: vi.fn().mockReturnValue(vi.fn()),
    readPageContent: vi.fn(),
    executeScript: vi.fn(),
    injectElementPicker: vi.fn(),
  };
}

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

describe("OpenAIAuth", () => {
  let auth: OpenAIAuth;
  let browser: ReturnType<typeof createMockBrowser>;
  let callbacks: AuthCallbacks;
  let progressHistory: string[];

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

  describe("login", () => {
    it("completes PKCE flow on successful redirect", async () => {
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () =>
            cb(42, "http://localhost:1455/auth/callback?code=abc123&state=AAECAwQFBgcICQoLDA0ODw"),
          0,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig",
            refresh_token: "rt_abc",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      expect(browser.openTab).toHaveBeenCalledOnce();
      const openTabUrl = vi.mocked(browser.openTab).mock.calls[0][0];
      expect(openTabUrl).toContain("https://auth.openai.com/oauth/authorize");
      expect(openTabUrl).toContain("client_id=app_EMoamEEZ73f0CkXaXp7hrann");
      // スコープの拡張を確認
      expect(openTabUrl).toContain("scope=openid+profile+email+offline_access");
      // Codex固有のパラメータ
      expect(openTabUrl).toContain("codex_cli_simplified_flow=true");
      expect(openTabUrl).toContain("originator=sitesurf");

      if (result.ok) {
        expect(result.value.providerId).toBe("openai");
        expect(result.value.accessToken).toBe("eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig");
        expect(result.value.refreshToken).toBe("rt_abc");
        expect(result.value.expiresAt).toBeGreaterThan(Date.now());
        expect(result.value.metadata.accountId).toBe("user-123");
      }

      expect(progressHistory).toContain("starting");
      expect(progressHistory).toContain("waiting-for-user");
    });

    it("extracts accountId from id_token when available", async () => {
      // id_tokenからchatgpt_account_idを抽出するテスト
      const idTokenPayload = {
        "https://api.openai.com/auth": {
          chatgpt_account_id: "chatgpt-acc-456",
        },
      };
      const idToken = `header.${btoa(JSON.stringify(idTokenPayload))}.sig`;

      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () =>
            cb(42, "http://localhost:1455/auth/callback?code=abc123&state=AAECAwQFBgcICQoLDA0ODw"),
          0,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig",
            id_token: idToken,
            refresh_token: "rt_abc",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      if (result.ok) {
        // id_tokenのchatgpt_account_idが優先される
        expect(result.value.metadata.accountId).toBe("chatgpt-acc-456");
      }
    });

    it("falls back to access_token sub when id_token is missing", async () => {
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(
          () =>
            cb(42, "http://localhost:1455/auth/callback?code=abc123&state=AAECAwQFBgcICQoLDA0ODw"),
          0,
        );
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmYWxsYmFjay11c2VyLTc4OSJ9.sig",
            refresh_token: "rt_abc",
            expires_in: 3600,
          }),
      }));

      const result = await auth.login(callbacks);

      if (result.ok) {
        // id_tokenがない場合はaccess_tokenのsubが使われる
        expect(result.value.metadata.accountId).toBe("fallback-user-789");
      }
    });

    it("returns auth_cancelled when tab is closed by user", async () => {
      vi.mocked(browser.onTabUpdated).mockReturnValue(vi.fn());
      vi.mocked(browser.onTabRemoved).mockImplementation((cb) => {
        setTimeout(() => cb(42), 0);
        return vi.fn();
      });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
        expect(result.error.message).toBe("認証がキャンセルされました");
      }
    });

    it("returns auth_cancelled when redirect has no code", async () => {
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(() => cb(42, "http://localhost:1455/auth/callback?error=access_denied"), 0);
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockReturnValue(vi.fn());

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
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

      mockFetch.mockImplementation(async () => {
        throw new Error("Network failure");
      });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_network");
        expect(result.error.message).toContain("トークン交換に失敗");
      }
    });

    it("ignores tab updates from other tabs", async () => {
      vi.mocked(browser.onTabUpdated).mockImplementation((cb) => {
        setTimeout(() => cb(99, "http://localhost:1455/auth/callback?code=abc&state=wrong"), 0);
        return vi.fn();
      });
      vi.mocked(browser.onTabRemoved).mockImplementation((cb) => {
        setTimeout(() => cb(42), 20);
        return vi.fn();
      });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
      }
    });
  });

  describe("refresh", () => {
    it("returns refreshed credentials on success", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new_token.eyJzdWIiOiJ1c2VyLTQ1NiJ9.sig",
            refresh_token: "new_rt",
            expires_in: 7200,
          }),
      }));

      const result = await auth.refresh({
        providerId: "openai",
        accessToken: "old_token",
        refreshToken: "old_rt",
        expiresAt: Date.now() - 1000,
        metadata: {},
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBe("new_token.eyJzdWIiOiJ1c2VyLTQ1NiJ9.sig");
        expect(result.value.refreshToken).toBe("new_rt");
      }

      expect(mockFetch).toHaveBeenCalledWith("https://auth.openai.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "old_rt",
          client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
          scope: "openid profile email offline_access",
        }),
      });
    });

    it("returns auth_refresh_failed on HTTP error", async () => {
      mockFetch.mockImplementation(async () => ({ ok: false, status: 401 }));

      const result = await auth.refresh({
        providerId: "openai",
        accessToken: "tok",
        refreshToken: "rt",
        expiresAt: 0,
        metadata: {},
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_refresh_failed");
      }
    });

    it("returns auth_network on network error", async () => {
      mockFetch.mockImplementation(async () => {
        throw new Error("Connection refused");
      });

      const result = await auth.refresh({
        providerId: "openai",
        accessToken: "tok",
        refreshToken: "rt",
        expiresAt: 0,
        metadata: {},
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_network");
      }
    });
  });

  describe("isValid", () => {
    it("returns true when token has not expired (with margin)", () => {
      const creds = {
        providerId: "openai",
        accessToken: "tok",
        refreshToken: "rt",
        expiresAt: Date.now() + 10 * 60 * 1000,
        metadata: {},
      };
      expect(auth.isValid(creds)).toBe(true);
    });

    it("returns false when within refresh margin (5 min)", () => {
      const creds = {
        providerId: "openai",
        accessToken: "tok",
        refreshToken: "rt",
        expiresAt: Date.now() + 3 * 60 * 1000,
        metadata: {},
      };
      expect(auth.isValid(creds)).toBe(false);
    });

    it("returns false when already expired", () => {
      const creds = {
        providerId: "openai",
        accessToken: "tok",
        refreshToken: "rt",
        expiresAt: Date.now() - 1000,
        metadata: {},
      };
      expect(auth.isValid(creds)).toBe(false);
    });
  });
});
