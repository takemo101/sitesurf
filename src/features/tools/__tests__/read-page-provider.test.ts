import { describe, expect, it, vi } from "vitest";
import { ReadPageProvider } from "../providers/read-page-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";
import { ok } from "@/shared/errors";
import { InMemoryArtifactStorage } from "@/adapters/storage/in-memory-storage";

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

describe("ReadPageProvider", () => {
  it("readPage() で軽量抽出を返し、maxDepth を BrowserExecutor に渡す", async () => {
    const readPageContent = vi.fn().mockResolvedValue(
      ok({
        text: "本文テキスト",
        simplifiedDom: "[Extraction: article]",
      }),
    );
    const browser = createMockBrowser({ readPageContent });
    const provider = new ReadPageProvider();

    const result = await provider.handleRequest(
      { id: "1", action: "readPage", maxDepth: 2 },
      { browser, artifactStorage: new InMemoryArtifactStorage() },
    );

    expect(readPageContent).toHaveBeenCalledWith(1, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      text: "本文テキスト",
      simplifiedDom: "[Extraction: article]",
    });
  });

  it("長い text / simplifiedDom を read_page 互換で切り詰める", async () => {
    const browser = createMockBrowser({
      readPageContent: async () =>
        ok({
          text: "a".repeat(10_000),
          simplifiedDom: "b".repeat(12_000),
        }),
    });
    const provider = new ReadPageProvider();

    const result = await provider.handleRequest(
      { id: "1", action: "readPage" },
      { browser, artifactStorage: new InMemoryArtifactStorage() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as { text: string }).text).toContain("truncated");
    expect((result.value as { simplifiedDom: string }).simplifiedDom).toContain("truncated");
  });

  it("アクティブタブがない場合は tool_tab_not_found を返す", async () => {
    const browser = createMockBrowser({
      getActiveTab: async () => ({ id: null, url: "", title: "" }),
    });
    const provider = new ReadPageProvider();

    const result = await provider.handleRequest(
      { id: "1", action: "readPage" },
      { browser, artifactStorage: new InMemoryArtifactStorage() },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tool_tab_not_found");
  });
});
