import { describe, expect, it } from "vitest";
import { pickElementToolDef, executePickElement } from "../pick-element";
import type { BrowserExecutor } from "@/ports/browser-executor";
import { ok } from "@/shared/errors";

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

describe("pickElementToolDef", () => {
  it("name は pick_element", () => {
    expect(pickElementToolDef.name).toBe("pick_element");
  });

  it("required は空", () => {
    expect((pickElementToolDef.parameters as Record<string, unknown>).required).toEqual([]);
  });

  it("parameters に message を含む", () => {
    const props = (pickElementToolDef.parameters as Record<string, unknown>).properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty("message");
  });
});

describe("executePickElement", () => {
  it("選択された要素情報を返す", async () => {
    const elementInfo = {
      selector: "#btn",
      tagName: "button",
      text: "Click me",
      html: "<button id='btn'>Click me</button>",
      attributes: { id: "btn" },
      boundingBox: { x: 10, y: 20, width: 100, height: 40 },
      surroundingHTML: "<div><button id='btn'>Click me</button></div>",
    };
    const browser = createMockBrowser({
      injectElementPicker: async () => ok(elementInfo),
    });

    const result = await executePickElement(browser, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toStrictEqual(elementInfo);
    }
  });

  it("キャンセル時は null を返す", async () => {
    const browser = createMockBrowser({
      injectElementPicker: async () => ok(null),
    });

    const result = await executePickElement(browser, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it("message を BrowserExecutor に渡す", async () => {
    let receivedMessage: string | undefined;
    const browser = createMockBrowser({
      injectElementPicker: async (_tabId, message) => {
        receivedMessage = message;
        return ok(null);
      },
    });

    await executePickElement(browser, { message: "要素を選んでください" });
    expect(receivedMessage).toBe("要素を選んでください");
  });

  it("tab.id が null の場合 tool_tab_not_found を返す", async () => {
    const browser = createMockBrowser({
      getActiveTab: async () => ({ id: null, url: "", title: "" }),
    });

    const result = await executePickElement(browser, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("tool_tab_not_found");
    }
  });
});
