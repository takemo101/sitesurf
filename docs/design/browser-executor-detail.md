# BrowserExecutor Adapter 詳細設計

## 概要

`adapters/chrome/chrome-browser-executor.ts` と `background/handlers/` の
内部設計を定める。Side Panel → Background → Content の通信パイプライン。

## アーキテクチャ上の位置づけ

```
features/tools/*  →  ports/browser-executor  →  adapters/chrome/chrome-browser-executor.ts
                                                  │  chrome.runtime.sendMessage
                                                  ▼
                                                background/index.ts (ルーター)
                                                  │
                                                  ├─ wire.ts          (WebSocket: ws://localhost:7331)
                                                  ├─ native-input.ts  (Chrome Debugger API)
                                                  └─ その他ハンドラ
                                                       │
                                                       │  REPL: chrome.userScripts.execute (IIFE)
                                                       │  DOM読取: chrome.scripting.executeScript
                                                       ▼
                                                     Content Script / ページ DOM
```

## ChromeBrowserExecutor (Side Panel 側)

```typescript
// adapters/chrome/chrome-browser-executor.ts

import type {
  BrowserExecutor,
  TabInfo,
  PageContent,
  ScriptResult,
  NavigationResult,
  ElementInfo,
} from "@/ports/browser-executor";
import type { BackgroundRequest, BackgroundResponse } from "@/shared/message-types";
import type { Result, BrowserError, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";

export class ChromeBrowserExecutor implements BrowserExecutor {
  private async send<T>(message: BackgroundRequest): Promise<Result<T, BrowserError>> {
    try {
      const response = (await chrome.runtime.sendMessage(message)) as BackgroundResponse<T>;
      if (response.success) return ok(response.data);
      return err({ code: response.code as BrowserError["code"], message: response.error });
    } catch (e: unknown) {
      return err({
        code: "browser_tab_closed",
        message: `Background通信エラー: ${(e as Error).message}`,
        cause: e,
      });
    }
  }

  async getActiveTab(): Promise<TabInfo> {
    const result = await this.send<TabInfo>({ type: "get-active-tab" });
    if (!result.ok) throw new Error(result.error.message); // 回復不能
    return result.value;
  }

  async readPageContent(
    tabId: number,
    maxDepth?: number,
  ): Promise<Result<PageContent, BrowserError>> {
    return this.send<PageContent>({ type: "read-page-content", tabId, maxDepth: maxDepth ?? 4 });
  }

  async executeScript(tabId: number, code: string): Promise<Result<ScriptResult, ToolError>> {
    const result = await this.send<ScriptResult>({ type: "execute-script", tabId, code });
    if (!result.ok) return err({ code: "tool_script_error", message: result.error.message });
    return result;
  }

  async navigateTo(tabId: number, url: string): Promise<Result<NavigationResult, BrowserError>> {
    return this.send<NavigationResult>({ type: "navigate", tabId, url });
  }

  async injectElementPicker(tabId: number, message?: string): Promise<ElementInfo | null> {
    const result = await this.send<ElementInfo | null>({
      type: "inject-element-picker",
      tabId,
      message,
    });
    if (!result.ok) return null;
    return result.value;
  }

  async captureScreenshot(): Promise<string> {
    const result = await this.send<string>({ type: "capture-screenshot" });
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  async openTab(url: string): Promise<number> {
    const tab = await chrome.tabs.create({ url, active: true });
    return tab.id!;
  }

  onTabUpdated(callback: (tabId: number, url: string) => void): () => void {
    const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.url) callback(tabId, info.url);
    };
    chrome.tabs.onUpdated.addListener(listener);
    return () => chrome.tabs.onUpdated.removeListener(listener);
  }

  onTabRemoved(callback: (tabId: number) => void): () => void {
    const listener = (tabId: number) => callback(tabId);
    chrome.tabs.onRemoved.addListener(listener);
    return () => chrome.tabs.onRemoved.removeListener(listener);
  }
}
```

## Background ハンドラ一覧

`src/background/handlers/` に以下のハンドラが存在する。

| ファイル           | 役割                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `session-lock.ts`  | セッションロック管理（複数ウィンドウ間の排他制御）                    |
| `panel-tracker.ts` | サイドパネルの開閉状態を追跡                                          |
| `wire.ts`          | 外部 AI エージェントからの WebSocket ブリッジ (`ws://localhost:7331`) |
| `native-input.ts`  | Chrome Debugger API 経由のネイティブ入力イベント生成                  |

`wire.ts` と `native-input.ts` は `chrome.runtime.onMessage` ルーターを経由せず、それぞれ独立した通信チャネルを持つ。

- **wire.ts**: WebSocket (`ws://localhost:7331`) で外部プロセスからのコマンドを受け付け、`BrowserExecutor` を通じて操作を実行する。MCP Server 機能が有効のときのみ接続を試みる。
- **native-input.ts**: `BG_NATIVE_INPUT` 型のメッセージを `chrome.runtime.onMessage` で受け付け、Chrome Debugger API (`Input.dispatchMouseEvent` / `Input.dispatchKeyEvent`) を使って `isTrusted: true` なイベントを生成する。

## Background ルーター

```typescript
// background/index.ts

import { acquireLock, releaseLocksForWindow } from "./handlers/session-lock";
import { addOpenPanel, removeOpenPanel } from "./handlers/panel-tracker";
import { initWire, sendPing } from "./handlers/wire";
import "./handlers/native-input"; // メッセージリスナーを登録するだけ

// Side Panel の接続管理 (セッションロック・パネル追跡)
chrome.runtime.onConnect.addListener((port) => {
  const match = /^sidepanel:(\d+)$/.exec(port.name);
  if (!match) return;
  const windowId = Number(match[1]);
  addOpenPanel(windowId);

  port.onMessage.addListener(async (msg) => {
    if (msg.type === "acquireLock") {
      const result = await acquireLock(msg.sessionId, msg.windowId);
      port.postMessage({ type: "lockResult", ...result });
    } else if (msg.type === "getLockedSessions") {
      // ...
    }
  });

  port.onDisconnect.addListener(() => {
    removeOpenPanel(windowId);
    releaseLocksForWindow(windowId);
  });
});

// アイコンクリックでサイドパネルを開く
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
});

// Wire (MCP Server WebSocket) の初期化
initWire();
chrome.runtime.onStartup.addListener(initWire);
chrome.runtime.onInstalled.addListener(initWire);

// Wire の定期 ping (Service Worker のアイドル終了対策)
chrome.alarms.create("wire-keep-alive", { periodInMinutes: 25 / 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "wire-keep-alive") sendPing();
});
```

## Background ハンドラ例

### page-content.ts

```typescript
// background/handlers/page-content.ts

export async function handleReadPageContent(
  tabId: number,
): Promise<BackgroundResponse<PageContent>> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // ページ内で実行される関数
        const getDOM = (el: Element, depth: number, max: number): string => {
          if (depth > max || !el?.tagName) return "";
          const tag = el.tagName.toLowerCase();
          if (["script", "style", "noscript", "svg", "path"].includes(tag)) return "";
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") return "";

          const attrs: string[] = [];
          if (el.id) attrs.push(`id="${el.id}"`);
          // ... (属性の抽出)

          const indent = "  ".repeat(depth);
          const children = Array.from(el.children)
            .map((c) => getDOM(c, depth + 1, max))
            .filter(Boolean)
            .join("\n");

          return `${indent}<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>\n${children}`;
        };

        return {
          url: location.href,
          title: document.title,
          text: document.body?.innerText?.substring(0, 10000) || "",
          simplifiedDOM: getDOM(document.body, 0, 4),
        };
      },
    });
    return { success: true, data: results[0]?.result };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message, code: "browser_permission_denied" };
  }
}
```

### dom-action.ts (executeScript の実装)

REPL スクリプトの実行は `ChromeBrowserExecutor.executeScript` が担う（Background ハンドラを経由しない直接呼び出し）。実装は ADR-004 に従い `chrome.userScripts.execute` + IIFE パターンを使用する。`chrome.userScripts` が使えない環境では `chrome.scripting.executeScript` にフォールバックする。

```typescript
// adapters/chrome/chrome-browser-executor.ts (抜粋)

const SCRIPT_WORLD_ID = "sitesurf-exec";

private async executeViaUserScripts(
  tabId: number,
  code: string,
): Promise<Result<ScriptResult, ToolError>> {
  await this.configureUserScriptWorld();

  // すでに IIFE / async アロー形式のコードはそのまま渡す
  const trimmed = code.trim();
  const wrappedCode =
    trimmed.startsWith("(async") || trimmed.startsWith("(()")
      ? code
      : `(async () => { ${code} })()`;

  const results = await chrome.userScripts.execute({
    js: [{ code: wrappedCode }],
    target: { tabId, allFrames: false },
    world: "USER_SCRIPT",
    worldId: SCRIPT_WORLD_ID,
    injectImmediately: true,
  });

  const rawResult = results?.[0]?.result;
  if (rawResult === undefined) {
    return err({ code: "tool_script_error", message: "スクリプト結果なし" });
  }
  return normalizeScriptResponse(rawResult);
}

// フォールバック: chrome.userScripts が利用不可の場合
private async executeViaScripting(
  tabId: number,
  code: string,
): Promise<Result<ScriptResult, ToolError>> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [code, 30_000],
    func: async (scriptCode: string, timeoutMs: number) => {
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      const fn = new AsyncFunction(scriptCode);
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Script timeout")), timeoutMs),
        ),
      ]);
      return { ok: true, value: result };
    },
  });
  // ...
}
```

> **ADR-004 要点**: `chrome.userScripts.execute` はコードを文字列として渡す際、最後の式評価結果を自動返却しない。IIFE `(async () => { ... })()` でラップして Promise の解決値を明示的に return させること。詳細は `docs/decisions/004-browserjs-script-execution.md` を参照。

## メッセージ型 (完全版)

`chrome.runtime.sendMessage` / `onMessage` を使うメッセージと、独立チャネルを使うメッセージの2種類がある。

### chrome.runtime.onMessage 経由 (SidepanelMessage / BackgroundRequest)

セッションロック系のメッセージは `chrome.runtime.onConnect` のポートを使うため、`BackgroundRequest` には含まれない。

```typescript
// shared/message-types.ts

export type BackgroundRequest =
  | { type: "get-active-tab" }
  | { type: "read-page-content"; tabId: number }
  | { type: "execute-script"; tabId: number; code: string }
  | { type: "navigate"; tabId: number; url: string }
  | { type: "inject-element-picker"; tabId: number; message?: string }
  | { type: "capture-screenshot" };

export type BackgroundResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };
```

### BG_NATIVE_INPUT メッセージ (native-input.ts が直接処理)

```typescript
// shared/message-types.ts

export interface NativeInputMessage {
  type: "BG_NATIVE_INPUT";
  action:
    | "click"
    | "doubleClick"
    | "rightClick"
    | "focus"
    | "blur"
    | "hover"
    | "scroll"
    | "selectText"
    | "type"
    | "press"
    | "keyDown"
    | "keyUp";
  tabId: number;
  selector?: string;
  text?: string;
  key?: string;
  options?: NativeInputClickOptions; // { button?, offsetX?, offsetY? }
  scrollOptions?: NativeInputScrollOptions; // { behavior?, block? }
  start?: number;
  end?: number;
}

export interface NativeInputResponse {
  success: boolean;
  error?: string;
}
```

### Wire (WebSocket) コマンド (wire.ts が直接処理)

`ws://localhost:7331` に対して JSON-RPC 風のメッセージを送受信する。`chrome.runtime.sendMessage` は使わない。

```typescript
// wire.ts が受け付けるメソッド
type WireMethod =
  | "tabs_list"
  | "tab_create" // { url: string }
  | "tab_navigate" // { tabId: number, url: string }
  | "tab_close" // { tabId: number }
  | "tab_switch" // { tabId: number }
  | "page_read" // { tabId: number }
  | "page_click" // { tabId: number, selector?: string, x?: number, y?: number }
  | "page_type" // { tabId: number, text: string, selector?: string }
  | "page_screenshot" // { tabId: number }
  | "page_eval" // { tabId: number, code: string }
  | "page_pick_element" // { tabId: number, message?: string }
  | "page_extract_image" // { tabId: number, selector: string, maxWidth?: number }
  | "ping";

// フレーム形式: { id: string, method: WireMethod, params?: Record<string, unknown> }
// レスポンス:   { id: string, result: unknown } | { id: string, error: string }
```

## 関連ドキュメント

- [ツール設計](../architecture/tools.md) - BrowserExecutor Port 定義
- [agent-loop 詳細設計](./agent-loop-detail.md) - ツール実行フロー
- [セッション管理](./session-management-detail.md) - セッションロック
- [Wire モード](./wire-mode.md) - WebSocket ブリッジによる外部 AI エージェント連携
- [ネイティブ入力イベント](./native-input-events.md) - Chrome Debugger API による isTrusted イベント生成
- [ADR-004](../decisions/004-browserjs-script-execution.md) - chrome.userScripts.execute の IIFE コード生成パターン
