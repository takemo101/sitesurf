import { describe, expect, it } from "vitest";
import { screenshotToolDef, executeScreenshot } from "../screenshot";
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

describe("screenshotToolDef", () => {
  it("name は screenshot", () => {
    expect(screenshotToolDef.name).toBe("screenshot");
  });

  it("parameters のプロパティは空", () => {
    expect((screenshotToolDef.parameters as Record<string, unknown>).properties).toEqual({});
  });

  it("required は空", () => {
    expect((screenshotToolDef.parameters as Record<string, unknown>).required).toEqual([]);
  });
});

describe("executeScreenshot", () => {
  it("スクリーンショットの data URL を返す", async () => {
    const browser = createMockBrowser({
      captureScreenshot: async () => "data:image/png;base64,abc123",
    });

    const result = await executeScreenshot(browser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dataUrl).toBe("data:image/png;base64,abc123");
    }
  });
});
