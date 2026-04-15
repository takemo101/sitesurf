# リトライ / レート制限設計

## 設計方針

**AI API のエラーを分類し、リトライ可能なエラーは自動リトライする。
リトライ不能なエラーはユーザーに明示的に通知する。**

## エラー分類とリトライ判定

| AIError code         | リトライ | 戦略                     | ユーザー通知               |
| -------------------- | -------- | ------------------------ | -------------------------- |
| `ai_rate_limit`      | ✅ 自動  | 指数バックオフ (最大3回) | リトライ中の表示           |
| `ai_network`         | ✅ 自動  | 固定間隔 (3秒, 最大3回)  | リトライ中の表示           |
| `ai_auth_invalid`    | ❌       | -                        | 「APIキーが無効です」      |
| `ai_model_not_found` | ❌       | -                        | 「モデルが見つかりません」 |
| `ai_unknown`         | ❌       | -                        | エラーメッセージ表示       |
| `auth_expired`       | 1回のみ  | refresh → 再試行         | 失敗なら「再ログイン」     |

## リトライの単位

### なぜ `withRetry(() => streamText())` ではダメか

`AIProvider.streamText()` は `AsyncIterable<StreamEvent>` を返す。
エラーは **iterable を消費する途中** (`for await ... of` の中) で発生する。
`streamText()` 呼び出し時点では例外が投げられないため、
`withRetry` で関数呼び出しをラップしても意味がない。

### 採用: マルチターンループの1ターン単位でリトライ

リトライの単位は「1回の `for await ... of` ループ全体」とする。

```typescript
// orchestration/agent-loop.ts

for (let turn = 0; turn < MAX_TURNS; turn++) {
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    let hasError = false;

    for await (const event of aiProvider.streamText({ model, systemPrompt, messages, tools })) {
      if (event.type === "error") {
        if (isRetryable(event.error) && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = calculateBackoff(retryCount, event.error);
          chatStore.addSystemMessage(
            `⏳ API接続をリトライ中... (${retryCount}回目, ${Math.round(delay / 1000)}秒後)`,
          );
          await sleep(delay);
          hasError = true;
          break; // for await を抜けて while でリトライ
        } else {
          chatStore.addErrorMessage(event.error);
          return; // リトライ不可 or 上限到達
        }
      }
      // text-delta, tool-call, finish の処理...
    }

    if (!hasError) break; // 正常終了 → while を抜ける
  }
  // ... ツール結果がなければ外側ループも抜ける
}
```

### バックオフ計算

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

function calculateBackoff(attempt: number, error: AppError): number {
  // Retry-After ヘッダーがあれば優先
  if ("retryAfterMs" in error && typeof error.retryAfterMs === "number") {
    return error.retryAfterMs;
  }
  // 指数バックオフ + ジッター
  return Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1) +
      Math.random() * 500,
    RETRY_CONFIG.maxDelayMs,
  );
}

function isRetryable(error: AppError): boolean {
  return error.code === "ai_rate_limit" || error.code === "ai_network";
}
```

### ストリーミング途中のエラーとリトライ

テキストが途中まで出力された状態でエラーが発生した場合:

- 途中のテキストは表示を維持
- リトライ時は **同じ messages を再送信** するため、AIは最初からやり直す
- UIには「⏳ リトライ中」表示 → 新しい応答がストリーミングされる

これは二重応答に見える可能性があるため、リトライ時に途中テキストをクリアするか検討が必要。
**v0.1 方針: 途中テキストはクリアして新しい応答に置き換える。**

```typescript
if (hasError && retryCount <= MAX_RETRIES) {
  // 途中テキストをクリア
  chatStore.clearLastAssistantMessage();
}
```

## 認証リフレッシュのリトライ

認証リフレッシュは `withRetry` ではなく agent-loop の `resolveAIProvider` 内で1回のみ試行。

```
streamText → error(ai_auth_invalid)
  → resolveAIProvider で AuthProvider.isValid() 再確認
  → AuthProvider.refresh()
    ├─ 成功 → 新トークンで streamText を再試行
    └─ 失敗 → "再ログインしてください" を表示
```

## レート制限への対応

### Retry-After ヘッダー

```typescript
// adapters/ai/converters.ts (toAIError 拡張)

export interface RetryableAIError extends AIError {
  retryAfterMs?: number;
}

if (msg.includes("rate limit") || msg.includes("429")) {
  const retryAfter = extractRetryAfter(error);
  return {
    code: "ai_rate_limit",
    message: retryAfter
      ? `レート制限中。${retryAfter}秒後にリトライします。`
      : "APIのレート制限に達しました。",
    cause: error,
    retryAfterMs: retryAfter ? retryAfter * 1000 : undefined,
  };
}
```

## UI 表示

### リトライ中

```
│ ⏳ API接続をリトライ中... (1回目, 2秒後) │  ← system message
│ ● ● ● (ストリーミングインジケーター)      │  ← 引き続き表示
```

### リトライ失敗

```
│ ❌ APIのレート制限に達しました。          │  ← error message
│    しばらく待ってから再度お試しください。    │
```

## 関連ドキュメント

- [agent-loop 詳細設計](./agent-loop-detail.md) - リトライの呼び出し元
- [エラーハンドリング](../architecture/error-handling.md) - AIError の型定義
- [AI Provider 詳細設計](./ai-provider-detail.md) - toAIError の変換
