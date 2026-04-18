import { describe, expect, it } from "vitest";
import { readPageToolDef, executeReadPage } from "../read-page";
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

describe("readPageToolDef", () => {
  it("name は read_page", () => {
    expect(readPageToolDef.name).toBe("read_page");
  });

  it("parameters の required は空", () => {
    expect((readPageToolDef.parameters as Record<string, unknown>).required).toEqual([]);
  });

  it("description に軽量抽出と簡潔な repl 誘導を含む", () => {
    expect(readPageToolDef.description).toContain("軽量");
    expect(readPageToolDef.description).toContain("複数ページを跨ぐ場合は `repl` で loop 制御");
    expect(readPageToolDef.description).not.toContain("```javascript");
  });
});

describe("executeReadPage", () => {
  it("アクティブタブのページコンテンツを返す", async () => {
    const browser = createMockBrowser({
      readPageContent: async () =>
        ok({
          text: "Hello World",
          simplifiedDom: "[Extraction: article]\nMeta: desc\n\nHello World",
        }),
    });

    const result = await executeReadPage(browser, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe("Hello World");
      expect(result.value.simplifiedDom).toContain("Extraction:");
    }
  });

  it("tab.id が null の場合 tool_tab_not_found を返す", async () => {
    const browser = createMockBrowser({
      getActiveTab: async () => ({ id: null, url: "", title: "" }),
    });

    const result = await executeReadPage(browser, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("tool_tab_not_found");
    }
  });

  it("長いテキストを切り詰める", async () => {
    const longText = "a".repeat(10_000);
    const browser = createMockBrowser({
      readPageContent: async () => ok({ text: longText, simplifiedDom: "" }),
    });

    const result = await executeReadPage(browser, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text.length).toBeLessThan(longText.length);
      expect(result.value.text).toContain("truncated");
    }
  });
});
