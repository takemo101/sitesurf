import type {
  BrowserExecutor,
  ElementInfo,
  NavigationResult,
  PageContent,
  ScriptResult,
  TabInfo,
  Unsubscribe,
} from "@/ports/browser-executor";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { isExcludedUrl } from "@/shared/utils";
import { extractPageContentLightweight, type LightweightExtraction } from "./page-extractor";

const log = createLogger("chrome-executor");

const NAVIGATION_TIMEOUT_MS = 30_000;
const SCRIPT_WORLD_ID = "sitesurf-exec";
const PERMISSION_ERROR_MESSAGE =
  "ページへの権限がありません。タブをクリックしてから再試行してください。";

export class ChromeBrowserExecutor implements BrowserExecutor {
  async getActiveTab(): Promise<TabInfo> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("アクティブタブが見つかりません");
    return { id: tab.id, url: tab.url ?? "", title: tab.title ?? "" };
  }

  async openTab(url: string): Promise<number> {
    const tab = await chrome.tabs.create({ url, active: true });
    if (tab.id == null) throw new Error("タブIDを取得できませんでした");
    return tab.id;
  }

  async navigateTo(tabId: number, url: string): Promise<Result<NavigationResult, BrowserError>> {
    if (isExcludedUrl(url)) {
      return err({
        code: "browser_permission_denied",
        message: PERMISSION_ERROR_MESSAGE,
      });
    }

    try {
      await chrome.tabs.update(tabId, { url });
      await this.waitForDOMContentLoaded(tabId);
      const tab = await chrome.tabs.get(tabId);
      return ok({ url: tab.url ?? url, title: tab.title ?? "" });
    } catch (e: unknown) {
      log.error("ナビゲーションエラー", e);
      return err({
        code: "browser_navigation_timeout",
        message: getErrorMessage(e),
      });
    }
  }

  async captureScreenshot(): Promise<string> {
    return chrome.tabs.captureVisibleTab({ format: "png" });
  }

  onTabActivated(callback: (tabId: number) => void): Unsubscribe {
    const listener = (info: chrome.tabs.OnActivatedInfo) => callback(info.tabId);
    chrome.tabs.onActivated.addListener(listener);
    return () => chrome.tabs.onActivated.removeListener(listener);
  }

  onTabUpdated(callback: (tabId: number, url: string) => void): Unsubscribe {
    const listener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (changeInfo.url) callback(tabId, changeInfo.url);
    };
    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  }

  onTabRemoved(callback: (tabId: number) => void): Unsubscribe {
    const listener = (tabId: number) => callback(tabId);
    chrome.tabs.onRemoved.addListener(listener);
    return () => chrome.tabs.onRemoved.removeListener(listener);
  }

  async readPageContent(
    tabId: number,
    _maxDepth?: number,
  ): Promise<Result<PageContent, BrowserError>> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || isExcludedUrl(tab.url)) {
        return err({ code: "browser_permission_denied", message: PERMISSION_ERROR_MESSAGE });
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: extractPageContentLightweight,
      });

      const data = results[0]?.result as LightweightExtraction;
      const text = data.h1 ? `${data.h1}\n\n${data.text}` : data.text;
      const simplifiedDom = [
        `[Extraction: ${data.method}]`,
        data.description ? `Meta: ${data.description}` : "",
        data.h1 ? `H1: ${data.h1}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return ok({ text, simplifiedDom });
    } catch (e: unknown) {
      log.error("readPageContent エラー", e);
      return err({
        code: "browser_permission_denied",
        message: getErrorMessage(e),
      });
    }
  }

  async executeScript(
    tabId: number,
    code: string,
    _signal?: AbortSignal,
  ): Promise<Result<ScriptResult, ToolError>> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || isExcludedUrl(tab.url)) {
        return err({ code: "tool_script_error", message: PERMISSION_ERROR_MESSAGE });
      }

      if (typeof chrome.userScripts?.execute === "function") {
        return await this.executeViaUserScripts(tabId, code);
      }
      return await this.executeViaScripting(tabId, code);
    } catch (e: unknown) {
      log.error("executeScript エラー", e);
      const message = getErrorMessage(e);

      if (isPermissionError(message)) {
        return err({ code: "tool_script_error", message: PERMISSION_ERROR_MESSAGE });
      }

      return err({ code: "tool_script_error", message });
    }
  }

  private async executeViaUserScripts(
    tabId: number,
    code: string,
  ): Promise<Result<ScriptResult, ToolError>> {
    await this.configureUserScriptWorld();

    const trimmed = code.trim();
    const innerExpr =
      trimmed.startsWith("(async") || trimmed.startsWith("(()")
        ? trimmed
        : `(async () => { ${trimmed} })()`;

    // executeViaScripting と同じ { ok, value, error } 形式でラップし、
    // normalizeScriptResponse がユーザーの返却オブジェクトを内部ラッパーと
    // 誤認する問題を防ぐ
    const wrappedCode = `(async () => {
      try {
        const __result__ = await (${innerExpr});
        return { ok: true, value: __result__ };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    })()`;

    const results = await chrome.userScripts.execute({
      js: [{ code: wrappedCode }],
      target: { tabId, allFrames: false },
      world: "USER_SCRIPT",
      worldId: SCRIPT_WORLD_ID,
      injectImmediately: true,
    } as any);

    const rawResult = getUserScriptResult(results);
    if (rawResult === undefined) {
      return err({ code: "tool_script_error", message: "スクリプト結果なし" });
    }

    return normalizeScriptResponse(rawResult);
  }

  private async configureUserScriptWorld(): Promise<void> {
    try {
      await chrome.userScripts.configureWorld({ worldId: SCRIPT_WORLD_ID, messaging: true });
    } catch {}
  }

  private async executeViaScripting(
    tabId: number,
    code: string,
  ): Promise<Result<ScriptResult, ToolError>> {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [code, 30_000],
      func: async (scriptCode: string, timeoutMs: number) => {
        try {
          const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
          const fn = new AsyncFunction(scriptCode);

          const result = await Promise.race([
            fn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Script timeout")), timeoutMs),
            ),
          ]);

          return { ok: true, value: result };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });

    const rawResult = getUserScriptResult(results);
    if (rawResult === undefined) {
      return err({ code: "tool_script_error", message: "スクリプト結果なし" });
    }

    return normalizeScriptResponse(rawResult);
  }

  async injectElementPicker(
    tabId: number,
    message?: string,
  ): Promise<Result<ElementInfo | null, BrowserError>> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || isExcludedUrl(tab.url)) {
        return err({ code: "browser_permission_denied", message: PERMISSION_ERROR_MESSAGE });
      }

      await this.cleanupExistingPicker(tabId).catch(() => {});

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: injectPicker,
        args: [message ?? "要素をクリックして選択 · ESCでキャンセル"],
      });

      if (!results?.[0]) {
        return err({
          code: "browser_permission_denied",
          message: "スクリプト実行結果が取得できません",
        });
      }

      const result = results[0].result;
      if (result && typeof result === "object" && "error" in result) {
        return err({
          code: "browser_permission_denied",
          message: String((result as { error: string }).error),
        });
      }

      return ok(result as ElementInfo | null);
    } catch (e: unknown) {
      log.error("injectElementPicker エラー", e);
      return err({
        code: "browser_permission_denied",
        message: getErrorMessage(e),
      });
    }
  }

  private async cleanupExistingPicker(tabId: number): Promise<void> {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const w = window as unknown as {
          __sitesurfPickerCleanup?: () => void;
        };
        if (typeof w.__sitesurfPickerCleanup === "function") {
          w.__sitesurfPickerCleanup();
        }
        document.getElementById("sitesurf-picker-overlay")?.remove();
        document.getElementById("sitesurf-picker-banner")?.remove();
      },
    });
  }

  private waitForDOMContentLoaded(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
        reject(new Error(`ナビゲーションが${NAVIGATION_TIMEOUT_MS}ms以内に完了しませんでした`));
      }, NAVIGATION_TIMEOUT_MS);

      const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
        if (details.tabId === tabId && details.frameId === 0) {
          clearTimeout(timer);
          chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
          resolve();
        }
      };

      chrome.webNavigation.onDOMContentLoaded.addListener(listener);
    });
  }
}

function getUserScriptResult(results: unknown): unknown {
  return (results as any)?.[0]?.result;
}

/**
 * rawResult は必ず `{ ok: boolean; value?: unknown; error?: string }` 形式で
 * ラップされていることを前提とする。executeViaScripting / executeViaUserScripts
 * 両方でこの形式に統一済み。
 */
function normalizeScriptResponse(rawResult: unknown): Result<ScriptResult, ToolError> {
  const obj = rawResult as { ok?: boolean; value?: unknown; error?: string };
  if (obj && typeof obj === "object" && typeof obj.ok === "boolean") {
    if (obj.ok) {
      return ok({ value: obj.value });
    }
    return err({
      code: "tool_script_error",
      message: obj.error ?? "Script execution failed",
    });
  }
  return ok(rawResult as ScriptResult);
}

function isPermissionError(message: string): boolean {
  return message.includes("permission") || message.includes("activeTab");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function injectPicker(message: string): Promise<{
  selector: string;
  tagName: string;
  text: string;
  html: string;
  attributes: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
  surroundingHTML: string;
} | null> {
  return new Promise((resolve, reject) => {
    try {
      const OVERLAY_ID = "sitesurf-picker-overlay";
      const HIGHLIGHT_ID = "sitesurf-picker-highlight";
      const BANNER_ID = "sitesurf-picker-banner";
      const CANCEL_ID = "sitesurf-picker-cancel";

      const w = window as unknown as {
        __sitesurfPickerCleanup?: () => void;
      };
      if (typeof w.__sitesurfPickerCleanup === "function") {
        w.__sitesurfPickerCleanup();
      }

      const overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483646;pointer-events:none;";

      const highlight = document.createElement("div");
      highlight.id = HIGHLIGHT_ID;
      highlight.style.cssText =
        "position:absolute;pointer-events:none;border:3px solid #7c3aed;background:rgba(124,58,237,0.15);transition:all 0.15s ease;box-shadow:0 0 0 4px rgba(124,58,237,0.1);border-radius:4px;";
      overlay.appendChild(highlight);

      const banner = document.createElement("div");
      banner.id = BANNER_ID;
      banner.style.cssText =
        "position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:12px 20px;border-radius:8px;font:14px system-ui,sans-serif;z-index:2147483647;pointer-events:auto;display:flex;gap:12px;align-items:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);white-space:nowrap;";
      banner.innerHTML = `<span style="font-weight:500;">${message}</span><button id="${CANCEL_ID}" style="background:#4b5563;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;transition:background 0.2s;">✕ キャンセル</button>`;

      document.body.appendChild(overlay);
      document.body.appendChild(banner);

      let currentEl: Element | null = null;
      let isActive = true;

      const generateSelector = (el: Element): string => {
        if (el.id) return `#${CSS.escape(el.id)}`;

        const parts: string[] = [];
        let cur: Element | null = el;

        while (cur && cur !== document.body) {
          let sel = cur.tagName.toLowerCase();

          if (cur.className && typeof cur.className === "string") {
            const classes = cur.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
            if (classes.length) sel += `.${classes.map(CSS.escape).join(".")}`;
          }

          if (cur.parentElement) {
            const siblings = Array.from(cur.parentElement.children).filter(
              (s) => s.tagName === cur!.tagName,
            );
            if (siblings.length > 1) sel += `:nth-child(${siblings.indexOf(cur) + 1})`;
          }

          parts.unshift(sel);
          cur = cur.parentElement;
        }

        return parts.join(" > ");
      };

      const getSurroundingHTML = (el: Element): string => {
        let ancestor: Element | null = el;
        for (let i = 0; i < 3 && ancestor?.parentElement; i++) {
          ancestor = ancestor.parentElement;
        }
        if (!ancestor || ancestor === document.body) ancestor = el.parentElement ?? el;

        const clone = ancestor.cloneNode(true) as Element;
        clone.querySelectorAll("script,style,svg").forEach((node) => node.remove());

        const html = clone.outerHTML;
        return html.length > 1000 ? `${html.substring(0, 1000)}...` : html;
      };

      const isPickerUiTarget = (target: EventTarget | null): boolean => {
        if (!(target instanceof Node)) return false;
        return (
          target === banner ||
          banner.contains(target) ||
          target === overlay ||
          overlay.contains(target)
        );
      };

      const resolvePointerTarget = (e: PointerEvent): Element | null => {
        const fromPath = (e.composedPath?.()[0] as Element | undefined) ?? null;
        if (fromPath && !isPickerUiTarget(fromPath)) return fromPath;

        const fromTarget = e.target instanceof Element ? e.target : null;
        if (fromTarget && !isPickerUiTarget(fromTarget)) return fromTarget;

        const fromPoint = document.elementFromPoint(e.clientX, e.clientY);
        if (fromPoint && !isPickerUiTarget(fromPoint)) return fromPoint;

        return null;
      };

      const cleanup = () => {
        if (!isActive) return;
        isActive = false;
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        banner.remove();
        const ww = window as unknown as {
          __sitesurfPickerCleanup?: () => void;
        };
        if (ww.__sitesurfPickerCleanup === cleanup) {
          delete ww.__sitesurfPickerCleanup;
        }
      };

      const onMove = (e: MouseEvent) => {
        if (!isActive) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || isPickerUiTarget(el)) {
          highlight.style.display = "none";
          currentEl = null;
          return;
        }

        currentEl = el;
        const rect = el.getBoundingClientRect();
        highlight.style.display = "block";
        highlight.style.top = `${rect.top}px`;
        highlight.style.left = `${rect.left}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
      };

      const onClick = (e: MouseEvent) => {
        // pointerdown で確定するため、click は無効化のみ
        if (!isActive) return;
        if (isPickerUiTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };

      const onPointerDown = (e: PointerEvent) => {
        if (!isActive) return;
        if (isPickerUiTarget(e.target)) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (!currentEl) currentEl = resolvePointerTarget(e);

        if (!currentEl) return;

        const rect = currentEl.getBoundingClientRect();
        cleanup();

        resolve({
          selector: generateSelector(currentEl),
          tagName: currentEl.tagName.toLowerCase(),
          text: (currentEl.textContent?.trim() ?? "").substring(0, 300),
          html: currentEl.outerHTML.substring(0, 500),
          attributes: Object.fromEntries(
            Array.from(currentEl.attributes).map((a) => [a.name, a.value]),
          ),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          surroundingHTML: getSurroundingHTML(currentEl),
        });
      };

      const onKey = (e: KeyboardEvent) => {
        if (!isActive) return;
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };

      const cancelBtn = banner.querySelector<HTMLButtonElement>(`#${CANCEL_ID}`);
      if (cancelBtn) {
        cancelBtn.onmouseenter = () => {
          cancelBtn.style.background = "#6b7280";
        };
        cancelBtn.onmouseleave = () => {
          cancelBtn.style.background = "#4b5563";
        };
        cancelBtn.onclick = (e) => {
          e.stopPropagation();
          cleanup();
          resolve(null);
        };
      }

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey, true);
      w.__sitesurfPickerCleanup = cleanup;
    } catch (error) {
      reject(error);
    }
  });
}
