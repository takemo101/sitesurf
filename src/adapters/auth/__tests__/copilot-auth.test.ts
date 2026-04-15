import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotAuth } from "../copilot-auth";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { AuthCallbacks } from "@/ports/auth-provider";

vi.mock("@/shared/utils", () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

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

describe("CopilotAuth", () => {
  let auth: CopilotAuth;
  let browser: ReturnType<typeof createMockBrowser>;
  let callbacks: AuthCallbacks;
  let progressHistory: string[];
  let deviceCodeInfo: unknown;

  beforeEach(() => {
    vi.resetAllMocks();
    browser = createMockBrowser();
    auth = new CopilotAuth(browser);
    progressHistory = [];
    deviceCodeInfo = null;
    callbacks = {
      onProgress: (status) => progressHistory.push(status),
      onDeviceCode: (info) => {
        deviceCodeInfo = info;
      },
    };
  });

  describe("login", () => {
    function mockDeviceCodeAndToken(domain = "github.com") {
      let fetchCallIndex = 0;
      mockFetch.mockImplementation(async (url: string) => {
        const callIdx = fetchCallIndex++;
        if (callIdx === 0) {
          expect(url).toBe(`https://${domain}/login/device/code`);
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                device_code: "dc_abc",
                user_code: "ABCD-1234",
                verification_uri: `https://${domain}/login/device`,
                expires_in: 900,
                interval: 5,
              }),
          };
        }
        if (url.includes("/login/oauth/access_token")) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: "gho_ghtoken123" }),
          };
        }
        if (url.includes("/copilot_internal/v2/token")) {
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                token: "copilot_token_xyz",
                expires_at: Math.floor(Date.now() / 1000) + 3600,
              }),
          };
        }
        return { ok: false, status: 404 };
      });
    }

    it("completes device flow for github.com", async () => {
      mockDeviceCodeAndToken();

      const result = await auth.login(callbacks);

      expect(deviceCodeInfo).toEqual({
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
        expiresIn: 900,
        interval: 5,
      });
      expect(browser.openTab).toHaveBeenCalledWith("https://github.com/login/device");
      expect(progressHistory).toEqual(["starting", "waiting-for-user", "exchanging-token"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.providerId).toBe("copilot");
        expect(result.value.accessToken).toBe("copilot_token_xyz");
        expect(result.value.refreshToken).toBe("gho_ghtoken123");
        expect(result.value.metadata.enterpriseDomain).toBeUndefined();
      }
    });

    it("uses enterprise domain when provided", async () => {
      mockDeviceCodeAndToken("github.example.com");

      const result = await auth.login(callbacks, { enterpriseDomain: "github.example.com" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.enterpriseDomain).toBe("github.example.com");
      }
    });

    it("normalizes enterprise domain from full URL", async () => {
      mockDeviceCodeAndToken("github.example.com");

      const result = await auth.login(callbacks, {
        enterpriseDomain: "https://github.example.com",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.enterpriseDomain).toBe("github.example.com");
      }
    });

    it("falls back to github.com for invalid enterprise domain", async () => {
      mockDeviceCodeAndToken("github.com");

      const result = await auth.login(callbacks, { enterpriseDomain: "   " });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.enterpriseDomain).toBeUndefined();
      }
    });

    it("returns auth_network when device code request fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_network");
        expect(result.error.message).toContain("Device Code の取得に失敗");
      }
    });

    it("returns auth_cancelled when polling returns unrecognized error", async () => {
      let fetchCallIndex = 0;
      mockFetch.mockImplementation(async () => {
        const callIdx = fetchCallIndex++;
        if (callIdx === 0) {
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                device_code: "dc_abc",
                user_code: "ABCD-1234",
                verification_uri: "https://github.com/login/device",
                expires_in: 900,
                interval: 5,
              }),
          };
        }
        return {
          ok: true,
          json: () => Promise.resolve({ error: "access_denied" }),
        };
      });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_cancelled");
        expect(result.error.message).toContain("access_denied");
      }
    });

    it("returns auth_refresh_failed when copilot token exchange fails", async () => {
      let fetchCallIndex = 0;
      mockFetch.mockImplementation(async (url: string) => {
        const callIdx = fetchCallIndex++;
        if (callIdx === 0) {
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                device_code: "dc_abc",
                user_code: "ABCD-1234",
                verification_uri: "https://github.com/login/device",
                expires_in: 900,
                interval: 5,
              }),
          };
        }
        if (url.includes("/login/oauth/access_token")) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: "gho_token" }),
          };
        }
        return { ok: false, status: 403 };
      });

      const result = await auth.login(callbacks);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_refresh_failed");
      }
    });
  });

  describe("refresh", () => {
    it("exchanges GitHub token for new Copilot token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "new_copilot_token",
            expires_at: Math.floor(Date.now() / 1000) + 7200,
          }),
      });

      const result = await auth.refresh({
        providerId: "copilot",
        accessToken: "old_copilot_token",
        refreshToken: "gho_ghtoken123",
        expiresAt: Date.now() - 1000,
        metadata: {},
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBe("new_copilot_token");
        expect(result.value.refreshToken).toBe("gho_ghtoken123");
      }

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/copilot_internal/v2/token",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer gho_ghtoken123",
          }),
        }),
      );
    });

    it("uses enterprise domain from metadata for refresh", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "enterprise_token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          }),
      });

      const result = await auth.refresh({
        providerId: "copilot",
        accessToken: "old",
        refreshToken: "gho_token",
        expiresAt: 0,
        metadata: { enterpriseDomain: "github.example.com" },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.enterpriseDomain).toBe("github.example.com");
      }

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.example.com/copilot_internal/v2/token",
        expect.anything(),
      );
    });

    it("returns auth_refresh_failed on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await auth.refresh({
        providerId: "copilot",
        accessToken: "tok",
        refreshToken: "gho",
        expiresAt: 0,
        metadata: {},
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("auth_refresh_failed");
      }
    });
  });

  describe("isValid", () => {
    it("returns true when token has not expired (with margin)", () => {
      expect(
        auth.isValid({
          providerId: "copilot",
          accessToken: "tok",
          refreshToken: "rt",
          expiresAt: Date.now() + 10 * 60 * 1000,
          metadata: {},
        }),
      ).toBe(true);
    });

    it("returns false when within refresh margin", () => {
      expect(
        auth.isValid({
          providerId: "copilot",
          accessToken: "tok",
          refreshToken: "rt",
          expiresAt: Date.now() + 3 * 60 * 1000,
          metadata: {},
        }),
      ).toBe(false);
    });

    it("returns false when already expired", () => {
      expect(
        auth.isValid({
          providerId: "copilot",
          accessToken: "tok",
          refreshToken: "rt",
          expiresAt: Date.now() - 1000,
          metadata: {},
        }),
      ).toBe(false);
    });
  });
});
