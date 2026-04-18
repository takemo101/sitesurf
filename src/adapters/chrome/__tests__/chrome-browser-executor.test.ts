import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeBrowserExecutor } from "../chrome-browser-executor";

const mockTabsQuery = vi.fn();
const mockTabsCreate = vi.fn();
const mockTabsUpdate = vi.fn();
const mockTabsGet = vi.fn();
const mockCaptureVisibleTab = vi.fn();

const mockExecuteScript = vi.fn();
const mockUserScriptsExecute = vi.fn();
const mockConfigureWorld = vi.fn();

const mockOnActivatedAddListener = vi.fn();
const mockOnActivatedRemoveListener = vi.fn();
const mockOnUpdatedAddListener = vi.fn();
const mockOnUpdatedRemoveListener = vi.fn();
const mockOnRemovedAddListener = vi.fn();
const mockOnRemovedRemoveListener = vi.fn();
const mockDOMContentLoadedAddListener = vi.fn();
const mockDOMContentLoadedRemoveListener = vi.fn();

vi.stubGlobal("chrome", {
  tabs: {
    query: mockTabsQuery,
    create: mockTabsCreate,
    update: mockTabsUpdate,
    get: mockTabsGet,
    captureVisibleTab: mockCaptureVisibleTab,
    onActivated: {
      addListener: mockOnActivatedAddListener,
      removeListener: mockOnActivatedRemoveListener,
    },
    onUpdated: {
      addListener: mockOnUpdatedAddListener,
      removeListener: mockOnUpdatedRemoveListener,
    },
    onRemoved: {
      addListener: mockOnRemovedAddListener,
      removeListener: mockOnRemovedRemoveListener,
    },
  },
  scripting: {
    executeScript: mockExecuteScript,
  },
  userScripts: {
    execute: mockUserScriptsExecute,
    configureWorld: mockConfigureWorld,
  },
  webNavigation: {
    onDOMContentLoaded: {
      addListener: mockDOMContentLoadedAddListener,
      removeListener: mockDOMContentLoadedRemoveListener,
    },
  },
});

describe("ChromeBrowserExecutor", () => {
  let executor: ChromeBrowserExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ChromeBrowserExecutor();
  });

  it("getActiveTab: tabs.query から TabInfo を返す", async () => {
    mockTabsQuery.mockResolvedValue([{ id: 1, url: "https://example.com", title: "Example" }]);

    const result = await executor.getActiveTab();
    expect(result).toEqual({ id: 1, url: "https://example.com", title: "Example" });
    expect(mockTabsQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });

  it("openTab: tabs.create を使う", async () => {
    mockTabsCreate.mockResolvedValue({ id: 42 });

    const result = await executor.openTab("https://example.com");
    expect(result).toBe(42);
    expect(mockTabsCreate).toHaveBeenCalledWith({ url: "https://example.com", active: true });
  });

  it("navigateTo: tabs.update + DOMContentLoaded待機 + tabs.get", async () => {
    mockTabsUpdate.mockResolvedValue({});
    mockTabsGet.mockResolvedValue({ url: "https://example.com", title: "Example" });

    const promise = executor.navigateTo(1, "https://example.com");
    await Promise.resolve();
    const listener = mockDOMContentLoadedAddListener.mock.calls[0][0] as (
      details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
    ) => void;
    listener({ tabId: 1, frameId: 0 } as chrome.webNavigation.WebNavigationFramedCallbackDetails);

    const result = await promise;
    expect(result).toEqual({ ok: true, value: { url: "https://example.com", title: "Example" } });
    expect(mockTabsUpdate).toHaveBeenCalledWith(1, { url: "https://example.com" });
    expect(mockTabsGet).toHaveBeenCalledWith(1);
  });

  it("captureScreenshot: tabs.captureVisibleTab を使う", async () => {
    mockCaptureVisibleTab.mockResolvedValue("data:image/png;base64,abc");
    const result = await executor.captureScreenshot();
    expect(result).toBe("data:image/png;base64,abc");
    expect(mockCaptureVisibleTab).toHaveBeenCalledWith({ format: "png" });
  });

  it("readPageContent: scripting.executeScript(world: MAIN) で軽量抽出", async () => {
    mockExecuteScript.mockResolvedValue([
      {
        result: {
          h1: "Example",
          description: "A test page",
          text: "Hello",
          method: "article",
          outline: [
            { level: 1, text: "Example" },
            { level: 2, text: "Section A" },
          ],
        },
      },
    ]);

    const result = await executor.readPageContent(1);
    expect(result).toEqual({
      ok: true,
      value: {
        text: "Example\n\nHello",
        simplifiedDom:
          "[Extraction: article]\nMeta: A test page\nH1: Example\nOutline:\n- Example\n  - Section A",
      },
    });
    expect(mockExecuteScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 1 },
        world: "MAIN",
        func: expect.any(Function),
      }),
    );
  });

  it("executeScript: userScripts が使える場合はそちらを優先", async () => {
    mockUserScriptsExecute.mockResolvedValue([{ result: { ok: true, value: 42 } }]);

    const result = await executor.executeScript(1, "return 42");
    expect(result).toEqual({ ok: true, value: { value: 42 } });
    expect(mockConfigureWorld).toHaveBeenCalled();
    expect(mockUserScriptsExecute).toHaveBeenCalled();
    expect(mockExecuteScript).not.toHaveBeenCalled();
  });

  it("executeScript: userScripts 失敗時は tool_script_error", async () => {
    mockUserScriptsExecute.mockResolvedValue([{ result: { ok: false, error: "Script error" } }]);

    const result = await executor.executeScript(1, "bad code");
    expect(result).toEqual({
      ok: false,
      error: { code: "tool_script_error", message: "Script error" },
    });
  });

  it("executeScript: userScripts 未対応なら scripting.executeScript にフォールバック", async () => {
    const originalExecute = chrome.userScripts.execute;
    (chrome.userScripts as { execute?: typeof chrome.userScripts.execute }).execute = undefined;
    mockExecuteScript.mockResolvedValue([{ result: { ok: true, value: "done" } }]);

    const result = await executor.executeScript(1, "return 'done'");
    expect(result).toEqual({ ok: true, value: { value: "done" } });
    expect(mockExecuteScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 1 },
        world: "MAIN",
        args: ["return 'done'", 30000],
        func: expect.any(Function),
      }),
    );

    (chrome.userScripts as { execute?: typeof chrome.userScripts.execute }).execute =
      originalExecute;
  });

  it("injectElementPicker: scripting.executeScript(world: MAIN) を使う", async () => {
    const info = {
      selector: "#btn",
      tagName: "button",
      text: "Click",
      html: "<button>Click</button>",
      attributes: {},
      boundingBox: { x: 0, y: 0, width: 100, height: 40 },
      surroundingHTML: "<div><button>Click</button></div>",
    };
    mockExecuteScript.mockResolvedValue([{ result: info }]);

    const result = await executor.injectElementPicker(1, "要素を選択");
    expect(result).toEqual({ ok: true, value: info });
    expect(mockExecuteScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 1 },
        world: "MAIN",
        args: ["要素を選択"],
        func: expect.any(Function),
      }),
    );
  });

  it("onTabUpdated/onTabRemoved は listener 登録と解除ができる", () => {
    const onUpdated = vi.fn();
    const unSubUpdated = executor.onTabUpdated(onUpdated);
    const updatedListener = mockOnUpdatedAddListener.mock.calls[0][0] as (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ) => void;
    updatedListener(1, { url: "https://new.com" });
    updatedListener(1, { status: "loading" });
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith(1, "https://new.com");
    unSubUpdated();
    expect(mockOnUpdatedRemoveListener).toHaveBeenCalledWith(updatedListener);

    const onRemoved = vi.fn();
    const unSubRemoved = executor.onTabRemoved(onRemoved);
    const removedListener = mockOnRemovedAddListener.mock.calls[0][0] as (tabId: number) => void;
    removedListener(5);
    expect(onRemoved).toHaveBeenCalledWith(5);
    unSubRemoved();
    expect(mockOnRemovedRemoveListener).toHaveBeenCalledWith(removedListener);
  });
});
