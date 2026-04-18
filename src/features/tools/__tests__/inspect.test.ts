import { describe, expect, it } from "vitest";
import { inspectToolDef, executeInspect } from "../inspect";
import type { BrowserExecutor } from "@/ports/browser-executor";
import { ok } from "@/shared/errors";

function createMockBrowser(overrides: Partial<BrowserExecutor> = {}): BrowserExecutor {
  return {
    getActiveTab: async () => ({ id: 1, url: "https://example.com", title: "Example" }),
    openTab: async () => 1,
    navigateTo: async () => ok({ url: "", title: "" }),
    captureScreenshot: async () => "data:image/png;base64,abc",
    onTabActivated: () => () => {},
    onTabUpdated: () => () => {},
    onTabRemoved: () => () => {},
    readPageContent: async () => ok({ text: "", simplifiedDom: "" }),
    executeScript: async () => ok({ value: undefined }),
    injectElementPicker: async () => ok(null),
    ...overrides,
  };
}

describe("inspectToolDef", () => {
  it("name は inspect", () => {
    expect(inspectToolDef.name).toBe("inspect");
  });

  it("required に action が含まれる", () => {
    expect((inspectToolDef.parameters as Record<string, unknown>).required).toEqual(["action"]);
  });

  it("parameters に action / message / selector / maxWidth を含む", () => {
    const props = (inspectToolDef.parameters as Record<string, unknown>).properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty("action");
    expect(props).toHaveProperty("message");
    expect(props).toHaveProperty("selector");
    expect(props).toHaveProperty("maxWidth");
  });
});

describe("executeInspect - pick_element", () => {
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

    const result = await executeInspect(browser, { action: "pick_element" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toStrictEqual(elementInfo);
    }
  });

  it("キャンセル時は null を返す", async () => {
    const browser = createMockBrowser({
      injectElementPicker: async () => ok(null),
    });

    const result = await executeInspect(browser, { action: "pick_element" });
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

    await executeInspect(browser, { action: "pick_element", message: "要素を選んでください" });
    expect(receivedMessage).toBe("要素を選んでください");
  });

  it("tab.id が null の場合 tool_tab_not_found を返す", async () => {
    const browser = createMockBrowser({
      getActiveTab: async () => ({ id: null, url: "", title: "" }),
    });

    const result = await executeInspect(browser, { action: "pick_element" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("tool_tab_not_found");
    }
  });
});

describe("executeInspect - screenshot", () => {
  it("スクリーンショットの dataUrl を返す", async () => {
    const browser = createMockBrowser({
      captureScreenshot: async () => "data:image/png;base64,abc123",
    });

    const result = await executeInspect(browser, { action: "screenshot" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const val = result.value as { dataUrl: string };
      expect(val.dataUrl).toBe("data:image/png;base64,abc123");
    }
  });
});

describe("executeInspect - extract_image", () => {
  it("selector がない場合はエラーを返す", async () => {
    const browser = createMockBrowser();

    const result = await executeInspect(browser, { action: "extract_image" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("tool_script_error");
    }
  });
});
