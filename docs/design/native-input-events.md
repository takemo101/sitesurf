# Native Input Events 設計書

## 概要

既存拡張 の `nativeClick`, `nativeType`, `nativePress`, `nativeKeyDown`, `nativeKeyUp` を tandemweb に移植する。

## 技術的背景

通常の JavaScript（`element.click()`, `element.dispatchEvent()`）では `isTrusted: true` なイベントを生成できない。
Chrome DevTools Protocol（CDP）の `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` を使うことで、
実際のユーザー操作と区別がつかないネイティブイベントを発火できる。

## アーキテクチャ

```
sandbox (REPL実行)
  ↓ postMessage: { type: "sandbox-request", action: "native-input", ... }
sidepanel (repl.ts の onMessage)
  ↓ chrome.runtime.sendMessage({ type: "BG_NATIVE_INPUT", ... })
background (service worker)
  ↓ chrome.debugger.attach() / Input.dispatchMouseEvent / Input.dispatchKeyEvent
対象タブ
```

**重要**: sandbox → sidepanel は `postMessage`、sidepanel → background は `chrome.runtime.sendMessage` を使う。

## 実装ファイル

### 1. `src/background/handlers/native-input.ts`（新規）

Background service worker で CDP 経由の入力イベントを処理する。

```typescript
// メッセージハンドラ
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "BG_NATIVE_INPUT") {
    handleNativeInput(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async
  }
});

// 修飾キー状態管理（インスタンス変数）
class NativeInputHandler {
  private modifiers = 0;
  private readonly MODIFIER_ALT = 1;
  private readonly MODIFIER_CTRL = 2;
  private readonly MODIFIER_META = 4;
  private readonly MODIFIER_SHIFT = 8;

  // 各アクション実装
  async click(tabId: number, selector: string, options?: ClickOptions): Promise<void>;
  async doubleClick(tabId: number, selector: string): Promise<void>;
  async rightClick(tabId: number, selector: string): Promise<void>;
  async focus(tabId: number, selector: string): Promise<void>;
  async blur(tabId: number, selector?: string): Promise<void>;
  async hover(tabId: number, selector: string): Promise<void>;
  async scroll(tabId: number, selector: string, options?: ScrollOptions): Promise<void>;
  async selectText(tabId: number, selector: string, start?: number, end?: number): Promise<void>;
  async type(tabId: number, selector: string, text: string): Promise<void>;
  async press(tabId: number, key: string): Promise<void>;
  async keyDown(tabId: number, key: string): Promise<void>;
  async keyUp(tabId: number, key: string): Promise<void>;

  // 必ず finally で呼ぶ
  private async detachDebugger(tabId: number): Promise<void>;
}

export const nativeInputHandler = new NativeInputHandler();
```

**エラーハンドリング**:

```typescript
try {
  await chrome.debugger.attach({ tabId }, "1.3");
  // ... 入力処理 ...
} catch (error) {
  throw error;
} finally {
  // 必ずデタッチしてバナーを消す
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // 既にデタッチ済みの場合は無視
  }
}
```

### 2. `src/features/tools/repl.ts`（修正）

Sandbox に native 関数を注入：

```typescript
// sandbox 注入コード（getRuntime 関数内）
(window as any).nativeClick = async (
  selector: string,
  options?: { button?: "left" | "right" | "middle"; offsetX?: number; offsetY?: number },
) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "click",
    selector,
    options,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeHover = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "hover",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeScroll = async (
  selector: string,
  options?: { behavior?: "auto" | "smooth"; block?: "start" | "center" | "end" | "nearest" },
) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "scroll",
    selector,
    options,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeSelectText = async (selector: string, start?: number, end?: number) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "selectText",
    selector,
    start,
    end,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeDoubleClick = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "doubleClick",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeRightClick = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "rightClick",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeFocus = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "focus",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeBlur = async (selector?: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "blur",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};
(window as any).nativeType = async (selector: string, text: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "type",
    selector,
    text,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativePress = async (key: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "press",
    key,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeKeyDown = async (key: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "keyDown",
    key,
  });
  if (!response.success) throw new Error(response.error);
};

(window as any).nativeKeyUp = async (key: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "keyUp",
    key,
  });
  if (!response.success) throw new Error(response.error);
};
```

**sidepanel でのハンドリング**:

```typescript
const onMessage = async (event: MessageEvent) => {
  const msg = event.data;

  if (msg.type === "sandbox-request" && msg.action === "native-input") {
    try {
      // background に転送
      const result = await chrome.runtime.sendMessage({
        type: "BG_NATIVE_INPUT",
        action: msg.nativeAction,
        selector: msg.selector,
        text: msg.text,
        key: msg.key,
        options: msg.options,
        start: msg.start,
        end: msg.end,
      });

      sandbox.contentWindow!.postMessage(
        {
          type: "sandbox-response",
          id: msg.id,
          ok: result.success,
          ...result,
        },
        "*",
      );
    } catch (e) {
      sandbox.contentWindow!.postMessage(
        {
          type: "sandbox-response",
          id: msg.id,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        },
        "*",
      );
    }
    return;
  }

  // ... 既存の browserjs, navigate ハンドラ ...
};
```

### 3. `public/manifest.json`（修正）

```json
"permissions": [
  "storage",
  "scripting",
  "sidePanel",
  "webNavigation",
  "tabs",
  "userScripts",
  "alarms",
  "notifications",
  "debugger"
]
```

## 追加関数詳細

### `nativeHover(selector: string)`

マウスカーソルを要素の中央に移動（hoverイベント発火）。

**CDP実装**: `Input.dispatchMouseEvent` with `type: "mouseMoved"`

1. `Runtime.evaluate` で要素の位置とサイズを取得 (`getBoundingClientRect`)
2. 要素中央の座標を計算
3. `Input.dispatchMouseEvent({ type: "mouseMoved", x, y })` で移動

### `nativeScroll(selector: string, options?: ScrollOptions)`

要素がビューポート内に表示されるようスクロール。既に表示されている場合は何もしない。

```typescript
interface ScrollOptions {
  behavior?: "auto" | "smooth";
  block?: "start" | "center" | "end" | "nearest";
}
```

**実装方針**:

1. `Runtime.evaluate` で要素の位置を取得 (`getBoundingClientRect`)
2. 要素がビューポート内にあるかチェック
3. 画面外の場合:
   - 方法A: `Runtime.evaluate` で `element.scrollIntoView({ behavior, block })`
   - 方法B: `Input.dispatchMouseEvent` でマウス移動後、ホイールイベント発火

**推奨**: 方法A（JS実行）が確実でシンプル。CDPの `scrollIntoView` は `isTrusted` 不要。

### `nativeSelectText(selector: string, start?: number, end?: number)`

テキスト選択。start/end省略時はトリプルクリックで全選択。

**実装方針**:

**範囲指定なし（トリプルクリック）**:

```typescript
// 要素中央にマウス移動後、3連続クリック
await Input.dispatchMouseEvent({ type: "mousePressed", x, y, clickCount: 1 });
await Input.dispatchMouseEvent({ type: "mouseReleased", x, y, clickCount: 1 });
await Input.dispatchMouseEvent({ type: "mousePressed", x, y, clickCount: 2 });
await Input.dispatchMouseEvent({ type: "mouseReleased", x, y, clickCount: 2 });
await Input.dispatchMouseEvent({ type: "mousePressed", x, y, clickCount: 3 });
await Input.dispatchMouseEvent({ type: "mouseReleased", x, y, clickCount: 3 });
```

**範囲指定あり**:

```typescript
// Runtime.evaluate で直接選択
await Runtime.evaluate({
  expression: `
    const el = document.querySelector("${selector}");
    if (el && el.setSelectionRange) {
      el.setSelectionRange(${start}, ${end});
      el.focus();
    }
  `,
});
```

### `nativeClick` の拡張

```typescript
nativeClick(
  selector: string,
  options?: {
    button?: "left" | "right" | "middle";
    offsetX?: number;  // 要素左上からの相対座標（px）
    offsetY?: number;
  }
)
```

**CDPパラメータ**:

- `button`: "left" → 0, "right" → 2, "middle" → 1（CDPの button 値）
- `offsetX/Y`: 省略時は要素中央を計算
- `clickCount`: 1（デフォルト）

**使用例**:

```typescript
// 右クリック（コンテキストメニュー）
await nativeClick("#target", { button: "right" });

// 特定位置をクリック
await nativeClick("#target", { offsetX: 10, offsetY: 10 });
```

### `nativeDoubleClick(selector: string)`

要素をダブルクリック。ファイル名編集やテキスト選択などに使用。

```typescript
(window as any).nativeDoubleClick = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "doubleClick",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};
```

**CDP実装**: `Input.dispatchMouseEvent` with `clickCount: 2`

```typescript
await Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
await Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
await Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 2 });
await Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 2 });
```

### `nativeRightClick(selector: string)`

要素を右クリック（コンテキストメニュー表示）。

```typescript
(window as any).nativeRightClick = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "rightClick",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};
```

**備考**: `nativeClick(selector, { button: "right" })` のエイリアスとして実装可能。

**CDP実装**: `button: "right"` を指定して click と同じシーケンス

### `nativeFocus(selector: string)`

クリックせずに要素にフォーカス（入力開始のみ）。

```typescript
(window as any).nativeFocus = async (selector: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "focus",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};
```

**実装方針**:

1. `Runtime.evaluate` で `element.focus()` を実行
2. または `Input.dispatchMouseEvent` で要素中央に移動（hover相当）

**推奨**: 方法A（JS実行）が確実

```typescript
await Runtime.evaluate({
  expression: `
    const el = document.querySelector("${selector}");
    if (el) { el.focus(); el.scrollIntoView({ block: "nearest" }); }
  `,
});
```

### `nativeBlur(selector?: string)`

要素からフォーカスを外す（バリデーション発火用）。selector省略時は現在のactiveElement。

```typescript
(window as any).nativeBlur = async (selector?: string) => {
  const response = await sendRuntimeMessage({
    type: "sandbox-request",
    action: "native-input",
    nativeAction: "blur",
    selector,
  });
  if (!response.success) throw new Error(response.error);
};
```

**実装方針**: `Runtime.evaluate` で `element.blur()` を実行

```typescript
const targetSelector = selector || "document.activeElement";
await Runtime.evaluate({
  expression: `
    const el = ${selector ? `document.querySelector("${selector}")` : "document.activeElement"};
    if (el && el.blur) el.blur();
  `,
});
```

## キーマッピング

`getKeyInfo(key)` で標準的なキー名を CDP 用のコードに変換：

| キー名     | code         | windowsVirtualKeyCode |
| ---------- | ------------ | --------------------- |
| Enter      | "Enter"      | 13                    |
| Tab        | "Tab"        | 9                     |
| Escape     | "Escape"     | 27                    |
| ArrowRight | "ArrowRight" | 39                    |
| a-z        | "KeyA" etc   | 65-90                 |
| 0-9        | "Digit0" etc | 48-57                 |
| Space      | " "          | 32                    |
| Backspace  | "Backspace"  | 8                     |
| Delete     | "Delete"     | 46                    |
| Meta/Cmd   | "Meta"       | 91                    |
| Control    | "Control"    | 17                    |
| Shift      | "Shift"      | 16                    |
| Alt        | "Alt"        | 18                    |

## 修飾キー状態管理

複数の `nativeKeyDown`/`nativeKeyUp` 呼び出し間で修飾キー状態を維持する必要がある。

```typescript
class NativeInputHandler {
  private modifiers = 0;
  private readonly MODIFIER_ALT = 1;
  private readonly MODIFIER_CTRL = 2;
  private readonly MODIFIER_META = 4;
  private readonly MODIFIER_SHIFT = 8;

  private updateModifierState(key: string, isDown: boolean): void {
    const bit = this.getModifierBit(key);
    if (bit === 0) return;

    if (isDown) {
      this.modifiers |= bit;
    } else {
      this.modifiers &= ~bit;
    }
  }

  private getModifierBit(key: string): number {
    switch (key) {
      case "Alt":
        return this.MODIFIER_ALT;
      case "Control":
        return this.MODIFIER_CTRL;
      case "Meta":
        return this.MODIFIER_META;
      case "Shift":
        return this.MODIFIER_SHIFT;
      default:
        return 0;
    }
  }
}
```

## エラーハンドリング

| エラー                 | 原因                                           | 対応                              |
| ---------------------- | ---------------------------------------------- | --------------------------------- |
| デバッガーアタッチ失敗 | タブが閉じられた、別のデバッガーがアタッチ済み | エラーメッセージを返す            |
| 要素が見つからない     | selector が無効                                | Runtime.evaluate の例外をキャッチ |
| 入力中のエラー         | ページが遷移した                               | 部分的な入力の可能性を示唆        |
| デタッチ失敗           | 既にデタッチ済み                               | 無視（ finally ブロック内）       |

## セキュリティ考慮事項

- `chrome.debugger` は強力な権限—`host_permissions` と組み合わせて任意のページを操作可能
- デバッガーアタッチ中は Chrome が「デバッガーが接続されています」バナーを表示
- 完了後は必ず `chrome.debugger.detach()` する（finally ブロックで保証）
- 内部ページ（`chrome://`, `chrome-extension://`）では実行不可
