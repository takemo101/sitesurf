import type { BrowserExecutor } from "@/ports/browser-executor";
import { requireNumber, requireString } from "./command-params";

export async function handleTabsList() {
  const tabs = await chrome.tabs.query({});
  return tabs.map((t) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    active: t.active,
    windowId: t.windowId,
  }));
}

export async function handleTabCreate(params: Record<string, unknown>, browser: BrowserExecutor) {
  return browser.openTab((params.url as string) || "about:blank");
}

export async function handleTabNavigate(params: Record<string, unknown>, browser: BrowserExecutor) {
  const tabId = requireNumber(params, "tabId");
  const url = requireString(params, "url");
  const result = await browser.navigateTo(tabId, url);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function handleTabClose(params: Record<string, unknown>) {
  const tabId = requireNumber(params, "tabId");
  await chrome.tabs.remove(tabId);
  return { ok: true };
}

export async function handleTabSwitch(params: Record<string, unknown>) {
  const tabId = requireNumber(params, "tabId");
  const tab = await chrome.tabs.update(tabId, { active: true });
  if (tab?.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  return { id: tab?.id, title: tab?.title, url: tab?.url };
}
