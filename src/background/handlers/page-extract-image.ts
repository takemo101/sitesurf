import type { BrowserExecutor } from "@/ports/browser-executor";
import { executeExtractImage } from "@/shared/extract-image-core";
import { requireNumber, requireString } from "./command-params";

async function createTabBoundBrowser(
  tabId: number,
  browser: BrowserExecutor,
): Promise<BrowserExecutor> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.id) throw new Error("tab not found");

  return {
    openTab: (url) => browser.openTab(url),
    navigateTo: (targetTabId, url) => browser.navigateTo(targetTabId, url),
    captureScreenshot: () => browser.captureScreenshot(),
    onTabActivated: (callback) => browser.onTabActivated(callback),
    onTabUpdated: (callback) => browser.onTabUpdated(callback),
    onTabRemoved: (callback) => browser.onTabRemoved(callback),
    readPageContent: (targetTabId, maxDepth) => browser.readPageContent(targetTabId, maxDepth),
    executeScript: (targetTabId, code, signal) => browser.executeScript(targetTabId, code, signal),
    injectElementPicker: (targetTabId, message) =>
      browser.injectElementPicker(targetTabId, message),
    async getActiveTab() {
      return {
        id: tab.id ?? null,
        url: tab.url ?? "",
        title: tab.title ?? "",
      };
    },
  };
}

export async function handlePageExtractImage(
  params: Record<string, unknown>,
  browser: BrowserExecutor,
): Promise<unknown> {
  const tabId = requireNumber(params, "tabId");
  const selector = requireString(params, "selector");
  const maxWidth = typeof params.maxWidth === "number" ? params.maxWidth : undefined;
  const tabBoundBrowser = await createTabBoundBrowser(tabId, browser);
  const result = await executeExtractImage(tabBoundBrowser, { selector, maxWidth });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
