import type { BrowserExecutor } from "@/ports/browser-executor";
import { isExcludedUrl } from "@/shared/utils";
import { requireNumber, requireString } from "./command-params";

async function assertScriptableTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || isExcludedUrl(tab.url)) {
    throw new Error("このページではスクリプトを実行できません");
  }
}

export async function handlePageRead(params: Record<string, unknown>, browser: BrowserExecutor) {
  const tabId = requireNumber(params, "tabId");
  const result = await browser.readPageContent(tabId, 4);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function handlePageClick(params: Record<string, unknown>) {
  const tabId = requireNumber(params, "tabId");
  await assertScriptableTab(tabId);
  const selector = params.selector as string | undefined;
  const x = params.x as number | undefined;
  const y = params.y as number | undefined;

  if (selector) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return { error: `Element not found: ${sel}` };
        (el as HTMLElement).click();
        return { ok: true, tag: el.tagName, text: el.textContent?.slice(0, 50) };
      },
      args: [selector],
    });
    return results[0]?.result ?? { error: "no result" };
  }

  if (x !== undefined && y !== undefined) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (cx: number, cy: number) => {
        const el = document.elementFromPoint(cx, cy);
        if (!el) return { error: `No element at (${cx}, ${cy})` };
        (el as HTMLElement).click();
        return { ok: true, tag: el.tagName, text: el.textContent?.slice(0, 50) };
      },
      args: [x, y],
    });
    return results[0]?.result ?? { error: "no result" };
  }

  throw new Error("selector or x,y coordinates required");
}

export async function handlePageType(params: Record<string, unknown>) {
  const tabId = requireNumber(params, "tabId");
  await assertScriptableTab(tabId);
  const text = requireString(params, "text");
  const selector = params.selector as string | undefined;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (txt: string, sel: string | null) => {
      const el = sel ? document.querySelector(sel) : document.activeElement;
      if (!el) return { error: "No element to type into" };
      (el as HTMLInputElement).focus();
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        (el as HTMLInputElement).value = txt;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        el.textContent = txt;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return { ok: true, tag: el.tagName };
    },
    args: [text, selector ?? null],
  });
  return results[0]?.result ?? { error: "no result" };
}

export async function handlePageScreenshot(
  params: Record<string, unknown>,
  browser: BrowserExecutor,
) {
  requireNumber(params, "tabId");
  const dataUrl = await browser.captureScreenshot();
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return { image: base64, format: "png" };
}

export async function handlePageEval(params: Record<string, unknown>, browser: BrowserExecutor) {
  const tabId = requireNumber(params, "tabId");
  const code = requireString(params, "code");
  const result = await browser.executeScript(tabId, code);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.value;
}

export async function handlePagePickElement(
  params: Record<string, unknown>,
  browser: BrowserExecutor,
) {
  const tabId = requireNumber(params, "tabId");
  const message = params.message as string | undefined;
  const result = await browser.injectElementPicker(tabId, message);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
