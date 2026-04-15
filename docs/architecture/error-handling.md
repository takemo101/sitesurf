# エラーハンドリング設計

## 設計方針

**エラーを回復可能性で分類し、型で表現する。
Portのメソッドは回復可能なエラーを Result 型で返し、回復不能なエラーは例外で投げる。**

## エラー分類

### 回復可能 (Result型で返す)

呼び出し元がエラー内容に応じて次のアクションを判断できるもの。

| エラー種別         | 例                            | 対応                           |
| ------------------ | ----------------------------- | ------------------------------ |
| **認証エラー**     | トークン期限切れ、APIキー無効 | リフレッシュ or 再ログイン促す |
| **ツール実行失敗** | セレクタ不一致、ページ未読込  | AIに失敗理由を伝え再試行を促す |
| **AI API エラー**  | レート制限、モデル不存在      | ユーザーに通知、リトライ       |
| **ページ操作失敗** | タブが閉じられた、権限不足    | AIに状況を伝える               |

### 回復不能 (例外で投げる)

プログラムの前提条件違反。発生したらバグ。

| エラー種別         | 例                                 |
| ------------------ | ---------------------------------- |
| **不変条件違反**   | DepsContext未設定でuseDeps()呼出し |
| **到達不能コード** | switch文のexhaustive check漏れ     |
| **引数不正**       | null不許可の引数にnull渡し         |

## エラー型

```typescript
// shared/errors.ts

/** アプリケーション全体の回復可能エラーの基底型 */
export interface AppError {
  code: string; // 機械可読なエラーコード
  message: string; // 人間可読なメッセージ
  cause?: unknown; // 元のエラー
}

/** AI API 関連エラー */
export interface AIError extends AppError {
  code: "ai_rate_limit" | "ai_auth_invalid" | "ai_model_not_found" | "ai_network" | "ai_unknown";
}

/** 認証関連エラー */
export interface AuthError extends AppError {
  code: "auth_expired" | "auth_refresh_failed" | "auth_cancelled" | "auth_network";
}

/** ツール実行関連エラー */
export interface ToolError extends AppError {
  code: "tool_tab_not_found" | "tool_script_error" | "tool_timeout" | "tool_picker_cancelled";
}

/** Background 通信エラー */
export interface BrowserError extends AppError {
  code: "browser_tab_closed" | "browser_permission_denied" | "browser_navigation_timeout";
}
```

### AIError の FinishReason

AIError の原因となる FinishReason には `"other"` も含まれる:

```typescript
type FinishReason = "stop" | "length" | "tool-calls" | "content-filter" | "error" | "other";
```

`"other"` はプロバイダー固有の終了理由など、上記分類に該当しない場合に使う。

## Port での使用

### Result型 (簡易版)

外部ライブラリ (neverthrow等) は導入せず、Union型で表現する。

```typescript
export type Result<T, E extends AppError = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ヘルパー
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });
```

### Port メソッドの戻り値

```typescript
// ports/ai-provider.ts
export interface AIProvider {
  streamText(params: StreamTextParams): AsyncIterable<StreamEvent>;
  // StreamEvent.error で AIError を返す
}

// ports/auth-provider.ts
export interface AuthProvider {
  login(
    callbacks: AuthCallbacks,
    options?: LoginOptions,
  ): Promise<Result<AuthCredentials, AuthError>>;
  refresh(credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>>;
}

// ports/browser-executor.ts
export interface BrowserExecutor {
  readPageContent(tabId: number): Promise<Result<PageContent, BrowserError>>;
  executeScript(tabId: number, code: string): Promise<Result<ScriptResult, ToolError>>;
  navigateTo(tabId: number, url: string): Promise<Result<NavigationResult, BrowserError>>;
  // ...
}

// ports/storage.ts — 定義は state-management.md を参照
// StoragePort は例外的にResult型を使わない (get はnull返し、set/removeは失敗が致命的)
```

## エラーの伝搬フロー

BrowserExecutor は Chrome API を直接呼び出す実装になっており、`chrome.runtime.sendMessage` 経由では伝搬しない。

```
adapters/chrome/ (Chrome API 直接呼び出し) → BrowserError / ToolError
  → features/tools/ → ToolError (変換 or パススルー)
    → orchestration/agent-loop → AIに結果として伝える or UIにエラー表示
      → features/chat/ → ChatMessage (role: "error")

adapters/ai/ → AIError
  → orchestration/agent-loop → UIにエラー表示
    → features/chat/ → ChatMessage (role: "error")

adapters/auth/ → AuthError
  → features/settings/ → 再ログインを促すUI表示
```

### AIへのエラー伝達

ツール実行が失敗した場合、`try/catch` で捕捉し、エラー内容を文字列としてAIへ返す。
例外はスローせず、次のターンでAIが別のアプローチを試みられるようにする。

```typescript
// orchestration/agent-loop.ts
try {
  const toolResult = await executeTool(event);
  messages.push({
    role: "tool",
    toolCallId: event.id,
    toolName: event.name,
    result: toolResult,
  });
} catch (e) {
  // エラーを文字列として AI に返す
  messages.push({
    role: "tool",
    toolCallId: event.id,
    toolName: event.name,
    result: `Error: ${e instanceof Error ? e.message : String(e)}`,
  });
}
```

### 401 エラーの検出

`toAIError` 関数は `error.statusCode` が `401` かどうかで認証エラーを判定する (メッセージ文字列のみでの照合は行わない):

```typescript
function toAIError(error: unknown): AIError {
  if (error && typeof error === "object" && "statusCode" in error) {
    if (error.statusCode === 401) {
      return {
        code: "ai_auth_invalid",
        message: "認証エラー: APIキーまたはトークンが無効です",
        cause: error,
      };
    }
  }
  // ...
}
```

### コンテキストオーバーフローエラーの回復

`isContextOverflowError()` が「token exceeds limit」系のエラーを検出した場合、メッセージを自動圧縮してリトライする:

```typescript
// orchestration/agent-loop.ts
if (isContextOverflowError(error)) {
  // メッセージ履歴を圧縮して再試行
  messages = await compressMessages(messages);
  continue; // ループ先頭に戻り streamText を再呼び出し
}
```

## UIでのエラー表示

```typescript
// features/chat/chat-store.ts
addErrorMessage(error: AppError) {
  this.addMessage({
    role: "error",
    content: error.message,
    errorCode: error.code,
  });
}
```

## 関連ドキュメント

- [概要](./overview.md)
- [AI接続設計](./ai-connection.md) - AIError, AuthError
- [ツール設計](./tools.md) - ToolError
- [状態管理設計](./state-management.md) - エラーメッセージの表示
