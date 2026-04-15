# AbortSignal 対応設計書

## 概要

REPL ツールの実行をキャンセルできるようにする。
Vercel AI SDK の `AbortSignal` を sandbox 実行に伝播させる。

## 現状の問題

現在の `executeRepl` はキャンセルに対応していない：

- 長時間実行されるスクレイピングスクリプトを止められない
- 無限ループに入った場合の対処がない

## 実装方針

### 1. `chrome.userScripts.terminate()` API の活用

Chrome 138+ で追加された `terminate(tabId, executionId)` を使用。

**注意**: このAPIは比較的新しく、すべてのChromeバージョンで利用可能ではない。
利用可能かどうかのランタイムチェックが必要。

```typescript
// API利用可能性チェック
const supportsTerminate = typeof chrome.userScripts?.terminate === "function";

// userScripts.execute() に executionId を付与
const injectionConfig: any = {
  js: [{ code: wrapperCode }],
  target: { tabId, allFrames: false },
  world: "USER_SCRIPT",
  worldId: FIXED_WORLD_ID,
  injectImmediately: true,
};

// terminate対応の場合のみ executionId を追加
if (supportsTerminate) {
  injectionConfig.executionId = crypto.randomUUID();
}

const results = await chrome.userScripts.execute(injectionConfig);

// キャンセル時（supportsTerminate が true の場合のみ）
if (supportsTerminate && executionId) {
  await chrome.userScripts.terminate(tabId, executionId);
}
```

### 2. AbortSignal の伝播パス

```
Agent (Vercel AI SDK)
  ↓ signal
toolExecutor
  ↓ signal（オプショナル）
executeRepl(browser, args, skillMatches, signal?)
  ↓
setup abort listener → terminate()（対応時）
```

### 3. API 変更（既存ツールへの影響最小化）

#### `src/features/tools/repl.ts`

```typescript
// signal はオプショナルで追加
export async function executeRepl(
  browser: BrowserExecutor,
  args: { title?: string; code: string },
  skillMatches?: readonly SkillMatch[],
  signal?: AbortSignal, // ← 追加（後方互換）
): Promise<Result<ReplResult, ToolError>>;
```

#### `src/features/tools/index.ts`

```typescript
// ToolExecutorFn に signal を追加（既存ツールは無視してOK）
export type ToolExecutorFn = (
  name: string,
  args: Record<string, unknown>,
  browser: BrowserExecutor,
  signal?: AbortSignal, // ← 追加（後方互換）
) => Promise<Result<unknown, AppError>>;

// createToolExecutorWithSkills も同様に signal を受け取る
export function createToolExecutorWithSkills(skillRegistry: SkillRegistry): ToolExecutorFn {
  return async (name, args, browser, signal?) => {
    switch (name) {
      case "repl": {
        const tab = await browser.getActiveTab();
        const skillMatches = tab.url ? skillRegistry.findMatchingSkills(tab.url) : [];
        return executeRepl(browser, args as { title?: string; code: string }, skillMatches, signal);
      }
      // ... 他のツールは signal を無視（既存動作）
    }
  };
}
```

#### 呼び出し側（agent-loop等）

```typescript
// Vercel AI SDK からの signal を受け取って渡す
const result = await toolExecutor(
  toolCall.name,
  toolCall.args,
  browser,
  abortSignal, // オプショナル
);
```

### 4. フォールバック

`chrome.userScripts.terminate()` が未対応のブラウザ：

- 警告ログを出力（`console.warn("terminate() not supported, cancellation unavailable")`）
- 通常実行（キャンセル不可）
- ユーザーには「キャンセル機能はこのブラウザでは利用できません」と通知

### 5. キャンセル処理の実装

```typescript
// ChromeBrowserExecutor.executeScript 内
async executeScript(
  tabId: number,
  code: string,
  signal?: AbortSignal  // 追加
): Promise<Result<ScriptResult, ToolError>> {
  const supportsTerminate = typeof chrome.userScripts?.terminate === "function";
  const executionId = supportsTerminate ? crypto.randomUUID() : undefined;

  // AbortSignal のリスナー設定
  let abortHandler: (() => Promise<void>) | undefined;

  if (signal && executionId) {
    abortHandler = async () => {
      try {
        await chrome.userScripts.terminate(tabId, executionId);
        log.debug("Script execution terminated by user");
      } catch (e) {
        log.error("Failed to terminate script:", e);
      }
    };

    signal.addEventListener("abort", abortHandler);
  }

  try {
    const config: any = {
      js: [{ code: wrappedCode }],
      target: { tabId, allFrames: false },
      world: "USER_SCRIPT",
      worldId: FIXED_WORLD_ID,
      injectImmediately: true,
    };

    if (executionId) {
      config.executionId = executionId;
    }

    const results = await chrome.userScripts.execute(config);

    // 結果チェック（キャンセルされた場合）
    if (signal?.aborted) {
      return err({
        code: "tool_execution_cancelled",
        message: "Script execution was cancelled by user"
      });
    }

    return processResults(results);

  } catch (error) {
    if (signal?.aborted) {
      return err({
        code: "tool_execution_cancelled",
        message: "Script execution was cancelled by user"
      });
    }
    throw error;
  } finally {
    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}
```

## エラーハンドリング

キャンセル時のレスポンス：

```typescript
{
  ok: false,
  error: {
    code: "tool_execution_cancelled",
    message: "Script execution was cancelled by user"
  }
}
```

ユーザーへの表示：

- 「スクリプト実行がキャンセルされました」
- または黙って終了（ユーザーが意図的にキャンセルしたため）

## 制限事項

| 項目               | 内容                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| **ブラウザ要件**   | Chrome 138+（`terminate()` API対応）                                   |
| **API有効化**      | `userScripts` APIが有効である必要がある                                |
| **Firefox**        | 未対応（`userScripts.execute` 自体が未対応）                           |
| **フォールバック** | 非対応ブラウザでは通常実行（キャンセル不可）                           |
| **タイミング**     | スクリプト開始後すぐにキャンセルしても、実行中の行で止まるわけではない |

## テスト方法

1. **対応ブラウザでのテスト**:
   - 長時間実行するスクリプトを開始
   - キャンセルボタンを押す
   - 実行が停止することを確認

2. **非対応ブラウザでのテスト**:
   - 警告ログが出力されることを確認
   - 通常実行されることを確認

3. **エッジケース**:
   - スクリプト完了直前のキャンセル
   - 連続したキャンセル操作
   - タブが閉じられた後のキャンセル
