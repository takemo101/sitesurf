import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";

// Result types (Union type for different actions)
export type NavigateResult = NavigateSuccessResult | ListTabsResult | SwitchTabResult;

export interface NavigateSuccessResult {
  finalUrl: string;
  title: string;
  favicon?: string;
  tabId: number;
}

export interface ListTabsResult {
  tabs: TabInfo[];
}

export interface SwitchTabResult {
  finalUrl: string;
  title: string;
  favicon?: string;
  tabId: number;
  switchedToTab: number;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  favicon?: string;
}

// Args type
export interface NavigateArgs {
  url?: string;
  newTab?: boolean;
  listTabs?: boolean;
  switchToTab?: number;
}

export const navigateToolDef: ToolDefinition = {
  name: "navigate",
  description: `Navigate to a URL or manage tabs.

Actions:
1. Navigate to URL: { "url": "https://example.com" }
2. Open in new tab: { "url": "https://example.com", "newTab": true }
3. List all tabs: { "listTabs": true }
4. Switch to tab: { "switchToTab": 12345 }

IMPORTANT: Do NOT navigate to a URL you have already visited in this session. Use read_page to re-read content if needed. Collect all necessary pages first, then proceed to analysis — do not loop between pages.

When switching tabs, use the tab ID from listTabs.
Tab IDs are temporary and may change when the browser restarts.`,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to navigate to (including https://)",
      },
      newTab: {
        type: "boolean",
        description: "If true, open URL in a new tab",
      },
      listTabs: {
        type: "boolean",
        description: "If true, return list of all open tabs",
      },
      switchToTab: {
        type: "number",
        description: "Tab ID to switch to (from listTabs)",
      },
    },
  },
};

export async function executeNavigate(
  browser: BrowserExecutor,
  args: NavigateArgs,
): Promise<Result<NavigateResult, ToolError | BrowserError>> {
  // listTabs action
  if (args.listTabs) {
    return listTabs();
  }

  // switchToTab action
  if (args.switchToTab !== undefined) {
    return switchToTab(args.switchToTab);
  }

  // Navigate actions
  if (args.url) {
    if (args.newTab) {
      return openInNewTab(args.url);
    }
    return navigateInCurrentTab(browser, args.url);
  }

  return err({
    code: "tool_script_error",
    message: 'Invalid arguments. Provide "url", "listTabs": true, or "switchToTab": number',
  });
}

async function listTabs(): Promise<Result<ListTabsResult, ToolError>> {
  try {
    const tabs = await chrome.tabs.query({});
    return ok({
      tabs: tabs.map((t) => ({
        id: t.id!,
        url: t.url || "",
        title: t.title || "Untitled",
        active: t.active || false,
        favicon: t.favIconUrl,
      })),
    });
  } catch (e: unknown) {
    return err({
      code: "tool_script_error",
      message: `Failed to list tabs: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

async function switchToTab(
  tabId: number,
): Promise<Result<SwitchTabResult, ToolError | BrowserError>> {
  try {
    // Verify tab exists
    const tab = await chrome.tabs.get(tabId);

    // Activate tab
    await chrome.tabs.update(tabId, { active: true });

    // Focus window
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    return ok({
      finalUrl: tab.url || "",
      title: tab.title || "Untitled",
      favicon: tab.favIconUrl,
      tabId,
      switchedToTab: tabId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("No tab")) {
      return err({
        code: "tool_tab_not_found",
        message: `Tab ${tabId} not found`,
      });
    }
    return err({
      code: "browser_navigation_timeout",
      message: msg,
    });
  }
}

async function openInNewTab(url: string): Promise<Result<NavigateSuccessResult, BrowserError>> {
  try {
    const newTab = await chrome.tabs.create({ url, active: true });
    if (!newTab.id) {
      return err({
        code: "browser_navigation_timeout",
        message: "Failed to create new tab",
      });
    }

    // Wait for DOMContentLoaded
    await waitForDOMContentLoaded(newTab.id);

    const tab = await chrome.tabs.get(newTab.id);
    return ok({
      finalUrl: tab.url || url,
      title: tab.title || "Untitled",
      favicon: tab.favIconUrl,
      tabId: newTab.id,
    });
  } catch (e: unknown) {
    return err({
      code: "browser_navigation_timeout",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function navigateInCurrentTab(
  browser: BrowserExecutor,
  url: string,
): Promise<Result<NavigateSuccessResult, ToolError | BrowserError>> {
  const tab = await browser.getActiveTab();
  if (tab.id === null) {
    return err({
      code: "tool_tab_not_found",
      message: "アクティブなタブがありません",
    });
  }

  const result = await browser.navigateTo(tab.id, url);
  if (!result.ok) {
    return result;
  }

  const updatedTab = await chrome.tabs.get(tab.id);
  return ok({
    finalUrl: updatedTab.url || url,
    title: updatedTab.title || "Untitled",
    favicon: updatedTab.favIconUrl,
    tabId: tab.id,
  });
}

// Helper: Wait for DOMContentLoaded
function waitForDOMContentLoaded(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0) {
        chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
        resolve();
      }
    };
    chrome.webNavigation.onDOMContentLoaded.addListener(listener);

    // Timeout after 30 seconds
    setTimeout(() => {
      chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
      resolve();
    }, 30000);
  });
}
