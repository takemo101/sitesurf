import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { navigateToolDef, executeNavigate } from "../navigate";
import type { BrowserExecutor } from "@/ports/browser-executor";
import { ok } from "@/shared/errors";

// Mock chrome APIs
const mockTabs = {
  query: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
};

const mockWindows = {
  update: vi.fn(),
};

let domContentLoadedListener: ((details: { tabId: number; frameId: number }) => void) | null = null;

const mockWebNavigation = {
  onDOMContentLoaded: {
    addListener: vi.fn((listener) => {
      domContentLoadedListener = listener;
    }),
    removeListener: vi.fn(() => {
      domContentLoadedListener = null;
    }),
  },
};

beforeEach(() => {
  global.chrome = {
    tabs: mockTabs,
    windows: mockWindows,
    webNavigation: mockWebNavigation,
  } as unknown as typeof chrome;
  domContentLoadedListener = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockBrowser(overrides: Partial<BrowserExecutor> = {}): BrowserExecutor {
  return {
    getActiveTab: async () => ({ id: 1, url: "https://example.com", title: "Example" }),
    openTab: async () => 1,
    navigateTo: async () => ok({ url: "", title: "" }),
    captureScreenshot: async () => "",
    onTabActivated: () => () => {},
    onTabUpdated: () => () => {},
    onTabRemoved: () => () => {},
    readPageContent: async () => ok({ text: "", simplifiedDom: "" }),
    executeScript: async () => ok({ value: undefined }),
    injectElementPicker: async () => ok(null),
    ...overrides,
  };
}

describe("navigateToolDef", () => {
  it("name は navigate", () => {
    expect(navigateToolDef.name).toBe("navigate");
  });

  it("url は required ではない (新しいタブ管理機能のため)", () => {
    const required = (navigateToolDef.parameters as Record<string, unknown>).required;
    expect(required).toBeUndefined();
  });
});

describe("executeNavigate", () => {
  describe("URL navigation", () => {
    it("指定 URL に移動して結果を返す", async () => {
      const browser = createMockBrowser({
        navigateTo: async (_tabId, _url) => ok({ url: "https://example.com/page", title: "Page" }),
      });
      mockTabs.get.mockResolvedValue({
        id: 1,
        url: "https://example.com/page",
        title: "Page",
        favIconUrl: "https://example.com/favicon.ico",
      });

      const result = await executeNavigate(browser, { url: "https://example.com/page" });
      expect(result.ok).toBe(true);
      if (result.ok && "finalUrl" in result.value) {
        expect(result.value.finalUrl).toBe("https://example.com/page");
        expect(result.value.title).toBe("Page");
        expect(result.value.tabId).toBe(1);
      }
    });

    it("url を BrowserExecutor に渡す", async () => {
      let receivedUrl = "";
      const browser = createMockBrowser({
        navigateTo: async (_tabId, url) => {
          receivedUrl = url;
          return ok({ url, title: "" });
        },
      });
      mockTabs.get.mockResolvedValue({
        id: 1,
        url: "https://test.com",
        title: "",
      });

      await executeNavigate(browser, { url: "https://test.com" });
      expect(receivedUrl).toBe("https://test.com");
    });

    it("tab.id が null の場合 tool_tab_not_found を返す", async () => {
      const browser = createMockBrowser({
        getActiveTab: async () => ({ id: null, url: "", title: "" }),
      });

      const result = await executeNavigate(browser, { url: "https://example.com" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("tool_tab_not_found");
      }
    });
  });

  describe("listTabs", () => {
    it("全タブのリストを返す", async () => {
      const browser = createMockBrowser();
      mockTabs.query.mockResolvedValue([
        {
          id: 1,
          url: "https://example.com",
          title: "Example",
          active: true,
          favIconUrl: "favicon1.ico",
        },
        { id: 2, url: "https://test.com", title: "Test", active: false },
      ]);

      const result = await executeNavigate(browser, { listTabs: true });
      expect(result.ok).toBe(true);
      if (result.ok && "tabs" in result.value) {
        const tabs = result.value.tabs;
        expect(tabs).toHaveLength(2);
        expect(tabs[0]).toEqual({
          id: 1,
          url: "https://example.com",
          title: "Example",
          active: true,
          favicon: "favicon1.ico",
        });
      }
    });

    it("エラー時は tool_script_error を返す", async () => {
      const browser = createMockBrowser();
      mockTabs.query.mockRejectedValue(new Error("Permission denied"));

      const result = await executeNavigate(browser, { listTabs: true });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("tool_script_error");
      }
    });
  });

  describe("switchToTab", () => {
    it("指定タブに切り替える", async () => {
      const browser = createMockBrowser();
      mockTabs.get.mockResolvedValue({
        id: 123,
        url: "https://switched.com",
        title: "Switched",
        favIconUrl: "favicon.ico",
        windowId: 1,
      });
      mockTabs.update.mockResolvedValue({});
      mockWindows.update.mockResolvedValue({});

      const result = await executeNavigate(browser, { switchToTab: 123 });
      expect(result.ok).toBe(true);
      if (result.ok && "switchedToTab" in result.value) {
        expect(result.value.switchedToTab).toBe(123);
        expect(result.value.finalUrl).toBe("https://switched.com");
        expect(result.value.title).toBe("Switched");
      }
      expect(mockTabs.update).toHaveBeenCalledWith(123, { active: true });
      expect(mockWindows.update).toHaveBeenCalledWith(1, { focused: true });
    });

    it("存在しないタブの場合 tool_tab_not_found を返す", async () => {
      const browser = createMockBrowser();
      mockTabs.get.mockRejectedValue(new Error("No tab with id: 999"));

      const result = await executeNavigate(browser, { switchToTab: 999 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("tool_tab_not_found");
      }
    });
  });

  describe("newTab", () => {
    it("新しいタブを開く", async () => {
      const browser = createMockBrowser();
      mockTabs.create.mockResolvedValue({ id: 999, url: "https://new.com", title: "New" });
      mockTabs.get.mockResolvedValue({
        id: 999,
        url: "https://new.com",
        title: "New Tab",
        favIconUrl: "favicon.ico",
      });

      // Start the operation
      const resultPromise = executeNavigate(browser, { url: "https://new.com", newTab: true });

      // Wait a tick for the listener to be registered
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Trigger the DOMContentLoaded event
      if (domContentLoadedListener) {
        domContentLoadedListener({ tabId: 999, frameId: 0 });
      }

      const result = await resultPromise;
      expect(result.ok).toBe(true);
      if (result.ok && "finalUrl" in result.value) {
        expect(result.value.tabId).toBe(999);
        expect(result.value.finalUrl).toBe("https://new.com");
      }
      expect(mockTabs.create).toHaveBeenCalledWith({ url: "https://new.com", active: true });
    });

    it("タブ作成失敗時は browser_navigation_timeout を返す", async () => {
      const browser = createMockBrowser();
      mockTabs.create.mockResolvedValue({ id: undefined });

      const result = await executeNavigate(browser, { url: "https://new.com", newTab: true });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("browser_navigation_timeout");
      }
    });
  });

  describe("invalid arguments", () => {
    it("引数がない場合 tool_script_error を返す", async () => {
      const browser = createMockBrowser();

      const result = await executeNavigate(browser, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("tool_script_error");
      }
    });
  });
});
