# 実装パターン詳細

## 概要

実装着手時に確実に必要となる具体的なコードパターンを定める。
Zustand store の統合、AI SDK Adapter の正確な接続、要素ピッカーの注入コード。

## 1. Zustand store の slice 統合

### パターン: StateCreator + intersection 型

Zustand v5 の slice パターンで、4つの slice を1つの store に統合する。

```typescript
// store/index.ts

import { create, type StateCreator } from "zustand";

// ============= 全 Slice の型 =============

export type AppStore = ChatSlice & SettingsSlice & SessionSlice & UISlice;

// ============= Chat Slice =============

export interface ChatSlice {
  messages: ChatMessage[];
  history: AIMessage[];
  isStreaming: boolean;
  abortController: AbortController | null;

  addUserMessage(content: string, image?: string): void;
  startNewAssistantMessage(): void;
  appendDelta(text: string): void;
  clearLastAssistantMessage(): void;
  addToolCall(tc: ToolCallInfo): void;
  updateToolCallResult(toolId: string, result: Result<unknown, ToolError>): void;
  addSystemMessage(text: string): void;
  addNavigationMessage(nav: { url: string; title: string; favicon?: string }): void;
  addErrorMessage(error: AppError): void;
  syncHistory(messages: AIMessage[]): void;
  setStreaming(v: boolean): void;
  getAbortSignal(): AbortSignal | undefined;
  clearAll(): void;
}

const createChatSlice: StateCreator<AppStore, [], [], ChatSlice> = (set, get) => ({
  messages: [],
  history: [],
  isStreaming: false,
  abortController: null,

  addUserMessage: (content, image) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          timestamp: Date.now(),
          image,
        },
      ],
    })),

  startNewAssistantMessage: () =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          toolCalls: [],
        },
      ],
    })),

  appendDelta: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content: msgs[i].content + text };
          break;
        }
      }
      return { messages: msgs };
    }),

  clearLastAssistantMessage: () =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content: "", toolCalls: [] };
          break;
        }
      }
      return { messages: msgs };
    }),

  addToolCall: (tc) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], toolCalls: [...(msgs[i].toolCalls || []), tc] };
          break;
        }
      }
      return { messages: msgs };
    }),

  updateToolCallResult: (toolId, result) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.toolCalls
          ? {
              ...m,
              toolCalls: m.toolCalls.map((tc) =>
                tc.id === toolId
                  ? {
                      ...tc,
                      result: result.ok
                        ? JSON.stringify(result.value).substring(0, 500)
                        : result.error.message,
                      success: result.ok,
                      isRunning: false,
                    }
                  : tc,
              ),
            }
          : m,
      ),
    })),

  addSystemMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), role: "system", content: text, timestamp: Date.now() },
      ],
    })),

  addNavigationMessage: (nav) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "navigation",
          content: nav.title,
          url: nav.url,
          favicon: nav.favicon,
          timestamp: Date.now(),
        },
      ],
    })),

  addErrorMessage: (error) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "error",
          content: error.message,
          errorCode: error.code,
          timestamp: Date.now(),
        },
      ],
    })),

  syncHistory: (messages) => set({ history: messages }),

  setStreaming: (v) =>
    set({
      isStreaming: v,
      abortController: v ? new AbortController() : null,
    }),

  getAbortSignal: () => get().abortController?.signal,

  clearAll: () => set({ messages: [], history: [] }),
});

// ============= Settings Slice =============

export interface SettingsSlice {
  settings: Settings;
  setSettings(partial: Partial<Settings>): void;
  setCredentials(creds: AuthCredentials | null): void;
}

const createSettingsSlice: StateCreator<AppStore, [], [], SettingsSlice> = (set) => ({
  settings: {
    provider: "anthropic",
    model: "",
    apiKey: "",
    baseUrl: "http://localhost:11434",
    enterpriseDomain: "",
    credentials: null,
  },
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  setCredentials: (creds) => set((s) => ({ settings: { ...s.settings, credentials: creds } })),
});

// ============= Session Slice =============

export interface SessionSlice {
  sessionList: SessionMeta[];
  activeSessionId: string | null;
  activeSessionSnapshot: Session | null;
  sessionLoading: boolean;

  setSessionList(list: SessionMeta[]): void;
  setActiveSession(session: Session): void;
  setActiveSessionId(id: string | null): void;
  setSessionLoading(v: boolean): void;
  loadSession(session: Session): void;
}

const createSessionSlice: StateCreator<AppStore, [], [], SessionSlice> = (set) => ({
  sessionList: [],
  activeSessionId: null,
  activeSessionSnapshot: null,
  sessionLoading: false,

  setSessionList: (list) => set({ sessionList: list }),
  setActiveSession: (session) =>
    set({ activeSessionSnapshot: session, activeSessionId: session.id }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSessionLoading: (v) => set({ sessionLoading: v }),
  loadSession: (session) =>
    set({
      activeSessionSnapshot: session,
      activeSessionId: session.id,
      messages: session.messages,
      history: session.history,
    }),
});

// ============= UI Slice =============

export interface UISlice {
  settingsOpen: boolean;
  currentTab: TabInfo;
  pendingScreenshot: string | null;
  theme: "auto" | "light" | "dark";

  setSettingsOpen(v: boolean): void;
  toggleSettings(): void;
  setTab(tab: TabInfo): void;
  setPendingScreenshot(s: string | null): void;
  setTheme(t: "auto" | "light" | "dark"): void;
}

const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  settingsOpen: false,
  currentTab: { id: null, url: "", title: "" },
  pendingScreenshot: null,
  theme: "auto",

  setSettingsOpen: (v) => set({ settingsOpen: v }),
  toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
  setTab: (tab) => set({ currentTab: tab }),
  setPendingScreenshot: (s) => set({ pendingScreenshot: s }),
  setTheme: (t) => set({ theme: t }),
});

// ============= Store 生成 =============

export const useStore = create<AppStore>()((...a) => ({
  ...createChatSlice(...a),
  ...createSettingsSlice(...a),
  ...createSessionSlice(...a),
  ...createUISlice(...a),
}));
```

## 2. AI SDK streamText Adapter の正確な接続

### AI SDK v6 の実際の API

```typescript
import { streamText } from "ai";

// streamText() は StreamTextResult を返す (Promise ではない、即座に返る)
const result = streamText({
  model,
  system: "...",
  messages: [...],
  tools: { ... },
  abortSignal,            // ✅ v6 でサポート
  maxSteps: 1,            // ツール自動実行を無効化 (手動で制御するため)
});

// result.fullStream は AsyncIterableStream<TextStreamPart>
for await (const part of result.fullStream) {
  // part.type: "text-delta" | "tool-call" | "finish" | "error" | ...
}
```

### TextStreamPart の主要な type (AI SDK v6)

| type                         | フィールド                                   | 用途                          |
| ---------------------------- | -------------------------------------------- | ----------------------------- |
| `text-delta`                 | `text: string`                               | テキストの差分                |
| `tool-call`                  | `toolCallId, toolName, args` (TypedToolCall) | ツール呼出し                  |
| `finish`                     | `finishReason, totalUsage`                   | 完了                          |
| `error`                      | `error: unknown`                             | エラー                        |
| `tool-result`                | `toolCallId, toolName, result`               | ツール結果 (maxSteps>1時のみ) |
| `start-step` / `finish-step` | -                                            | マルチステップの境界          |

### VercelAIAdapter の正確な実装

```typescript
// adapters/ai/vercel-ai-adapter.ts

import { streamText as sdkStreamText, type LanguageModel } from "ai";
import type { AIProvider, StreamTextParams, StreamEvent } from "@/ports/ai-provider";
import { toSDKMessages, toSDKTools, toStreamEvent, toAIError } from "./converters";

export class VercelAIAdapter implements AIProvider {
  constructor(private readonly modelFactory: (model: string) => LanguageModel) {}

  async *streamText(params: StreamTextParams): AsyncIterable<StreamEvent> {
    const model = this.modelFactory(params.model);

    // streamText は即座に StreamTextResult を返す (await 不要)
    const result = sdkStreamText({
      model,
      system: params.systemPrompt,
      messages: toSDKMessages(params.messages),
      tools: toSDKTools(params.tools),
      maxTokens: params.maxTokens,
      abortSignal: params.abortSignal,
      maxSteps: 1, // ツール自動実行を無効化。agent-loop が手動制御
    });

    try {
      // fullStream は AsyncIterableStream<TextStreamPart>
      for await (const part of result.fullStream) {
        const event = toStreamEvent(part);
        if (event) yield event;
      }
    } catch (error: unknown) {
      yield { type: "error", error: toAIError(error) };
    }
  }
}
```

### converters.ts の toStreamEvent (AI SDK v6 対応)

```typescript
// adapters/ai/converters.ts

import type { StreamEvent, FinishReason } from "@/ports/ai-provider";

/**
 * AI SDK v6 の TextStreamPart → Port の StreamEvent に変換。
 * 不要なイベント (text-start, text-end, reasoning-*, start-step 等) は null を返す。
 */
export function toStreamEvent(part: Record<string, unknown>): StreamEvent | null {
  switch (part.type) {
    case "text-delta":
      return { type: "text-delta", text: part.text as string };

    case "tool-call":
      return {
        type: "tool-call",
        id: part.toolCallId as string,
        name: part.toolName as string,
        args: part.args as Record<string, unknown>,
      };

    case "finish":
      return {
        type: "finish",
        finishReason: mapFinishReason(part.finishReason),
        usage: part.totalUsage
          ? {
              promptTokens: (part.totalUsage as any).promptTokens ?? 0,
              completionTokens: (part.totalUsage as any).completionTokens ?? 0,
              totalTokens:
                ((part.totalUsage as any).promptTokens ?? 0) +
                ((part.totalUsage as any).completionTokens ?? 0),
            }
          : undefined,
      };

    case "error":
      return { type: "error", error: toAIError(part.error) };

    // 以下は無視 (Port の StreamEvent にマッピングしない)
    case "text-start":
    case "text-end":
    case "reasoning-start":
    case "reasoning-end":
    case "reasoning-delta":
    case "tool-input-start":
    case "tool-input-end":
    case "tool-input-delta":
    case "tool-result": // maxSteps=1 なので発生しない
    case "tool-error":
    case "start-step":
    case "finish-step":
    case "start":
    case "abort":
    case "raw":
    case "source":
    case "file":
      return null;

    default:
      return null;
  }
}

function mapFinishReason(reason: unknown): FinishReason {
  switch (reason) {
    case "stop":
    case "end-turn":
      return "stop";
    case "tool-calls":
      return "tool-calls";
    case "length":
      return "length";
    default:
      return "error";
  }
}
```

### maxSteps: 1 の重要性

AI SDK は `maxSteps` を指定するとツール呼出し→実行→再送信を自動的に行う。
Sitesurf では `orchestration/agent-loop.ts` が手動でこのループを制御するため、
**`maxSteps: 1` にして自動実行を無効化する**。

## 3. 要素ピッカーの Background handler

### element-picker.ts

```typescript
// background/handlers/element-picker.ts

import type { BackgroundResponse } from "@/shared/message-types";

export async function handleElementPicker(
  tabId: number,
  promptMessage?: string,
): Promise<BackgroundResponse> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: injectPicker,
      args: [promptMessage || "要素をクリックして選択 · ESCでキャンセル"],
    });
    return { success: true, data: results[0]?.result };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message, code: "browser_permission_denied" };
  }
}

/**
 * ページに注入されるピッカー関数。
 * ページコンテキストで実行され、ユーザーのクリックを待って要素情報を返す。
 */
function injectPicker(message: string): Promise<ElementInfo | null> {
  return new Promise((resolve) => {
    // --- オーバーレイ ---
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;";

    // --- ハイライト ---
    const highlight = document.createElement("div");
    highlight.style.cssText =
      "position:absolute;pointer-events:none;border:2px solid #7c3aed;background:rgba(124,58,237,0.1);transition:all .1s;";
    overlay.appendChild(highlight);

    // --- バナー ---
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:10px 20px;border-radius:8px;font:14px system-ui;z-index:2147483647;pointer-events:auto;display:flex;gap:12px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.4);";
    banner.innerHTML = `<span>${message}</span><button style="background:#374151;border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;">✕</button>`;

    document.body.appendChild(overlay);
    document.body.appendChild(banner);

    let currentEl: Element | null = null;

    // --- セレクタ生成 ---
    const generateSelector = (el: Element): string => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.body) {
        let sel = cur.tagName.toLowerCase();
        if (cur.className && typeof cur.className === "string") {
          const cls = cur.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
          if (cls.length) sel += "." + cls.map(CSS.escape).join(".");
        }
        // 同タグの兄弟がいれば nth-child
        if (cur.parentElement) {
          const siblings = Array.from(cur.parentElement.children).filter(
            (s) => s.tagName === cur!.tagName,
          );
          if (siblings.length > 1) {
            sel += `:nth-child(${siblings.indexOf(cur) + 1})`;
          }
        }
        parts.unshift(sel);
        cur = cur.parentElement;
      }
      return parts.join(" > ");
    };

    // --- イベントハンドラ ---
    const cleanup = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      banner.remove();
    };

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === overlay || overlay.contains(el) || el === banner || banner.contains(el))
        return;
      currentEl = el;
      const rect = el.getBoundingClientRect();
      Object.assign(highlight.style, {
        top: rect.top + "px",
        left: rect.left + "px",
        width: rect.width + "px",
        height: rect.height + "px",
      });
    };

    const onClick = (e: MouseEvent) => {
      if (e.target === banner || banner.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!currentEl) return;
      const rect = currentEl.getBoundingClientRect();
      // 周辺DOM: 親3階層の簡略HTMLを取得
      const getSurroundingHTML = (el: Element): string => {
        let ancestor: Element | null = el;
        for (let i = 0; i < 3 && ancestor?.parentElement; i++) {
          ancestor = ancestor.parentElement;
        }
        if (!ancestor || ancestor === document.body) ancestor = el.parentElement || el;
        // 簡略化: script/style除去、テキスト短縮
        const clone = ancestor.cloneNode(true) as Element;
        clone.querySelectorAll("script,style,svg").forEach((e) => e.remove());
        let html = clone.outerHTML;
        // 長すぎる場合は切り詰め
        if (html.length > 1000) html = html.substring(0, 1000) + "...";
        return html;
      };

      const info = {
        selector: generateSelector(currentEl),
        tagName: currentEl.tagName.toLowerCase(),
        text: (currentEl.textContent?.trim() || "").substring(0, 300),
        html: currentEl.outerHTML.substring(0, 500),
        attributes: Object.fromEntries(
          Array.from(currentEl.attributes).map((a) => [a.name, a.value]),
        ),
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        surroundingHTML: getSurroundingHTML(currentEl),
      };
      cleanup();
      resolve(info);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(null);
      }
    };

    banner.querySelector("button")!.onclick = (e) => {
      e.stopPropagation();
      cleanup();
      resolve(null);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  });
}
```

### chrome.scripting.executeScript + async 関数の挙動

`chrome.scripting.executeScript` に渡す `func` が Promise を返す場合、
Chrome は **Promise が resolve するまで待ってから** `InjectionResult.result` に結果を設定する。

したがって `injectPicker` が `new Promise(resolve => ...)` を返し、
ユーザーのクリックで `resolve(info)` を呼ぶと、`executeScript` の結果に
`info` が入る。これは Chrome MV3 で正式にサポートされている。

### 注意: injectPicker は文字列化される

`chrome.scripting.executeScript({ func })` は `func` をシリアライズしてページに注入する。
そのため:

- 外部変数のクロージャは使えない (引数で渡す)
- import は使えない
- TypeScript の型は実行時に存在しない

`injectPicker` 内の `ElementInfo` 型は実行時には plain object として返される。

## 補足: postcss.config.cjs

build-config.md に含まれていなかったため追記:

```javascript
// postcss.config.cjs
module.exports = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};
```

## 関連ドキュメント

- [状態管理設計](../architecture/state-management.md) - slice 構造の方針
- [AI Provider 詳細設計](./ai-provider-detail.md) - Port 型定義
- [agent-loop 詳細設計](./agent-loop-detail.md) - streamText の使い方
- [BrowserExecutor 詳細](./browser-executor-detail.md) - Background handler
- [ビルド設定](./build-config.md) - vite.config.ts, postcss
