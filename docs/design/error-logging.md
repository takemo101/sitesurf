# エラーハンドリング / ロギング設計

## 概要

各レイヤーでのエラー伝播と、デバッグのための観測可能性を設計する。

## エラー伝播の全体像

```
Content Script
  │ 例外 / 戻り値
  ▼
Background handler
  │ BackgroundResponse { success: false, error, code }
  ▼
adapters/chrome/
  │ Result<T, BrowserError>
  ▼
orchestration/agent-loop
  │ ├─ ツールエラー → AI に ToolResultMessage.isError で通知
  │ ├─ AIエラー → ChatSlice.addErrorMessage
  │ └─ 認証エラー → ChatSlice.addErrorMessage + credentials クリア
  ▼
features/chat/
  │ ChatMessage { role: "error" }
  ▼
UI (MessageBubble, エラー表示)
```

### レイヤ別のエラー処理ルール

| レイヤ              | 入力                     | 出力                      | 責務                                               |
| ------------------- | ------------------------ | ------------------------- | -------------------------------------------------- |
| Background handlers | 例外                     | `BackgroundResponse`      | chrome.\* API エラーをキャッチし、コード付きで返す |
| adapters/chrome/    | `BackgroundResponse`     | `Result<T, BrowserError>` | 通信エラー含めて Result に変換                     |
| adapters/ai/        | SDK例外                  | `StreamEvent.error`       | SDK エラーを AIError に変換                        |
| adapters/auth/      | fetch例外                | `Result<T, AuthError>`    | HTTPエラーを AuthError に変換                      |
| orchestration/      | `Result` / `StreamEvent` | ChatSlice アクション      | エラー分類に応じて UI通知 or AI通知                |
| features/chat/      | `addErrorMessage()`      | `ChatMessage`             | 表示用にフォーマット                               |

## ロギング設計

### ログレベル

```typescript
// shared/logger.ts

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

export function createLogger(module: string): Logger {
  const prefix = `[TandemWeb:${module}]`;
  return {
    debug: (msg, data) => console.debug(prefix, msg, data ?? ""),
    info: (msg, data) => console.info(prefix, msg, data ?? ""),
    warn: (msg, data) => console.warn(prefix, msg, data ?? ""),
    error: (msg, err) => console.error(prefix, msg, err ?? ""),
  };
}
```

### モジュール別ログ

```typescript
// 使用例
const log = createLogger("agent-loop");
log.info("streamText 開始", { model, messageCount: messages.length });
log.debug("tool-call", { name: event.name, args: event.args });
log.error("streamText エラー", event.error);

const log = createLogger("chrome-executor");
log.debug("sendMessage", { type: message.type });
log.warn("Background 通信タイムアウト", { tabId });
```

### ログ出力先

| 環境              | 出力先                                          |
| ----------------- | ----------------------------------------------- |
| 開発              | Chrome DevTools Console (Side Panel)            |
| 開発 (Background) | chrome://extensions → Service Worker の Inspect |
| 本番              | 同上 (console.\* は残す。外部送信はしない)      |

### ログで追跡すべきイベント

| イベント                    | レベル | モジュール          |
| --------------------------- | ------ | ------------------- |
| streamText 開始/終了        | info   | agent-loop          |
| tool-call 開始/完了         | debug  | agent-loop          |
| ツール実行エラー            | warn   | agent-loop          |
| AI API エラー               | error  | agent-loop          |
| 認証リフレッシュ            | info   | agent-loop          |
| 認証リフレッシュ失敗        | error  | agent-loop          |
| セッション保存              | debug  | auto-save           |
| セッション切替              | info   | session-store       |
| コンテキスト圧縮            | info   | compressor          |
| Background メッセージ送受信 | debug  | chrome-executor     |
| chrome.scripting エラー     | error  | background handlers |
| IndexedDB エラー            | error  | indexeddb-storage   |

## DevTools 連携

### Side Panel の DevTools

Side Panel は独立したページなので、右クリック → 「検証」で DevTools を開ける。
`console.*` はここに表示される。

### Background の DevTools

`chrome://extensions` → TandemWeb → 「Service Worker」の「Inspect」リンク。
Background のログはここに表示される。

### デバッグ用のグローバル公開 (開発時のみ)

```typescript
// sidepanel/main.tsx (開発時のみ)
if (import.meta.env.DEV) {
  (window as any).__tandemweb = {
    store: useStore,
    deps,
    getSession: () => useStore.getState().activeSessionSnapshot,
  };
}
```

## 関連ドキュメント

- [エラーハンドリング (アーキテクチャ)](../architecture/error-handling.md) - エラー型定義
- [agent-loop 詳細設計](./agent-loop-detail.md) - エラー発生ポイント
- [BrowserExecutor 詳細](./browser-executor-detail.md) - Background 通信エラー
