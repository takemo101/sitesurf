# OpenAI OAuth (Codex) 詳細設計

## 概要

OpenAI の ChatGPT Plus/Pro サブスクリプションを利用して、
OAuth 認証経由で GPT モデル (gpt-5.4, gpt-5.3-codex 等) にアクセスする機能。

現在 API キーのみ対応している OpenAI プロバイダーに、
GitHub Copilot と同様の OAuth ログインを追加する。

## 背景

OpenAI Codex CLI が使用する OAuth フローを利用すると、
ChatGPT サブスクリプション枠で API アクセスが可能になる。

- **認証フロー**: OAuth 2.0 PKCE (Authorization Code + PKCE)
- **API エンドポイント**: `chatgpt.com/backend-api/codex/responses` (通常の `api.openai.com` ではない)
- **Client ID**: `app_EMoamEEZ73f0CkXaXp7hrann` (Codex CLI と共通)
- **必須ヘッダー**: `Authorization`, `chatgpt-account-id`, `OpenAI-Beta`

### API キー方式との違い

| 項目           | API キー方式                  | OAuth (Codex) 方式                               |
| -------------- | ----------------------------- | ------------------------------------------------ |
| 認証           | `sk-...` キーをヘッダーに付与 | OAuth PKCE → access_token                        |
| エンドポイント | `api.openai.com/v1`           | `chatgpt.com/backend-api/codex/responses`        |
| API 形式       | Chat Completions / Responses  | Responses API のみ                               |
| 追加ヘッダー   | なし                          | `chatgpt-account-id`, `OpenAI-Beta`              |
| 課金           | API クレジット                | ChatGPT サブスクリプション枠                     |
| 利用可能モデル | 全モデル                      | Codex 対応モデルのみ (gpt-5.4, gpt-5.3-codex 等) |

## 変更箇所の概要

### 1. `src/features/settings/provider-visibility.ts` — OAuth セクションの表示

OpenAI プロバイダー選択時に OAuth セクションを表示する。

```typescript
// Before
showOAuth: provider.authType === "oauth" && providerId !== "openai",

// After
showOAuth: provider.authType === "oauth",
```

OpenAI は `authType: "oauth"` が既に設定されている (`constants.ts`)。
API キー入力欄も引き続き表示する (API キーと OAuth の両方を選択肢として提供)。

### 2. `src/ports/ai-provider.ts` — ProviderConfig に accountId 追加

Codex API は `chatgpt-account-id` ヘッダーが必須。
OAuth 認証で取得した `accountId` を provider-factory に渡すため、ProviderConfig を拡張する。

```typescript
export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  oauthToken?: string;
  baseUrl?: string;
  apiMode?: ApiMode;
  enterpriseDomain?: string;
  accountId?: string; // ← 追加: OpenAI Codex の chatgpt-account-id 用
}
```

### 3. `src/adapters/auth/openai-auth.ts` — PKCE フローの修正

既存実装の修正点:

#### a. スコープの拡張

```typescript
// Before
url.searchParams.set("scope", "openid offline_access");

// After
url.searchParams.set("scope", "openid profile email offline_access");
```

`profile` と `email` を追加。`id_token` から `accountId` を取得するために必要。

#### b. audience パラメータの追加

Codex API アクセスに必要な audience を指定する。

```typescript
url.searchParams.set("audience", "https://api.openai.com/v1");
```

#### c. accountId の抽出ロジック変更

`access_token` の JWT `sub` クレームではなく、
`id_token` の `https://api.openai.com/auth.chatgpt_account_id` クレームから取得する。

```typescript
function toCredentials(data: Record<string, unknown>): AuthCredentials {
  const accessToken = data.access_token as string;
  const idToken = data.id_token as string | undefined;
  const accountId = deriveAccountId(idToken) ?? extractSubFromJwt(accessToken);

  return {
    providerId: "openai",
    accessToken,
    refreshToken: data.refresh_token as string,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
    metadata: { accountId },
  };
}

/** id_token から chatgpt_account_id を取得 */
function deriveAccountId(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    const authClaim = payload["https://api.openai.com/auth"];
    if (authClaim && typeof authClaim === "object") {
      const accountId = authClaim.chatgpt_account_id;
      if (typeof accountId === "string" && accountId.length > 0) return accountId;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** フォールバック: access_token の sub クレームを使用 */
function extractSubFromJwt(token: string): string | undefined {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub;
  } catch {
    return undefined;
  }
}
```

#### d. refresh 時のスコープ

```typescript
body: JSON.stringify({
  grant_type: "refresh_token",
  refresh_token: credentials.refreshToken,
  client_id: CLIENT_ID,
  scope: "openid profile email offline_access",  // ← スコープ追加
}),
```

### 4. `src/adapters/ai/provider-factory.ts` — Codex エンドポイント対応

OpenAI プロバイダーで `oauthToken` がある場合、Codex エンドポイントに切り替える。

```typescript
case "openai": {
  if (config.oauthToken) {
    // OAuth (Codex) モード: chatgpt.com/backend-api/codex を使用
    const baseURL = config.baseUrl || "https://chatgpt.com/backend-api/codex";
    const client = createOpenAI({
      baseURL,
      apiKey: config.oauthToken,
      headers: {
        "chatgpt-account-id": config.accountId ?? "",
        "OpenAI-Beta": "responses=experimental",
      },
    });
    // Codex API は Responses API のみ対応
    return (model) => client.responses(model);
  }
  // API キーモード: 従来通り
  const client = createOpenAI({
    apiKey: config.apiKey!,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });
  return (model) => resolveOpenAIModel(client, model, config.apiMode);
}
```

#### 設計判断: API モードの強制

Codex エンドポイントは **Responses API のみ** をサポートする。
OAuth モード時は `client.responses(model)` を強制し、
ユーザーの `apiMode` 設定は無視する。

### 5. `orchestration/agent-loop.ts` — resolveAIProvider の変更

`accountId` を `ProviderConfig` に渡す。

```typescript
const factory = deps.createModelFactory({
  provider: settings.provider,
  model: settings.model,
  apiKey: settings.apiKey,
  oauthToken: credentials?.accessToken,
  enterpriseDomain: credentials?.metadata?.enterpriseDomain,
  accountId: credentials?.metadata?.accountId, // ← 追加
  baseUrl: settings.baseUrl,
  apiMode: settings.apiMode,
});
```

### 6. UI の表示ロジック

#### OpenAI プロバイダー選択時の設定パネル

```
┌─────────────────────────────────────────┐
│ AI設定                                   │
│                                          │
│ プロバイダー: [OpenAI (ChatGPT)    ▼]   │
│ モデル:       [gpt-5.4             ▼]   │
│ 思考レベル:   [中 (推奨)           ▼]   │
│                                          │
│ APIキー:      [sk-...               ]   │
│ エンドポイントURL: [                ]   │
│ APIモード:    [自動 (デフォルト)    ▼]   │
│                                          │
│ ────────── または ──────────             │
│                                          │
│ [OpenAIでログイン]                       │
│                                          │
│ [保存] [閉じる]                          │
└─────────────────────────────────────────┘
```

- API キーと OAuth は **排他的ではなく併存** する
- OAuth で接続済みの場合、API キー入力欄も残る (切り替え可能)
- OAuth 接続済み + API キーが空 → OAuth トークンを使用
- API キーが入力されている場合 → API キーを優先 (従来通り)

#### 優先順位ロジック (agent-loop)

```typescript
// OAuth トークンの使用判定
const useOAuth = !settings.apiKey && credentials?.providerId === "openai";
const oauthToken = useOAuth ? credentials.accessToken : undefined;
```

これにより:

- API キーが設定されていればそちらを使用 (従来の動作)
- API キーが空で OAuth 接続済みなら OAuth を使用
- ユーザーは API キーを消してOAuth に切り替えられる

### 7. `OAuthSection.tsx` の調整

OpenAI 向けの追加 UI 変更は不要。
既存の「OpenAIでログイン」ボタンがそのまま使える。

ただし、OpenAI OAuth ログイン成功時に追加のフィードバックを表示する:

```tsx
// OAuthSection 内 - 接続済み表示
if (credentials) {
  return (
    <>
      <Divider label="OAuth" labelPosition="center" />
      <Group gap="xs">
        <Badge color="green" variant="dot">
          接続済み
        </Badge>
        {provider === "openai" && (
          <Text size="xs" c="dimmed">
            Codex API 経由
          </Text>
        )}
        <Button variant="subtle" size="xs" color="red" onClick={handleDisconnect}>
          切断
        </Button>
      </Group>
    </>
  );
}
```

## CORS の考慮

| エンドポイント                            | Chrome 拡張からのアクセス                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `auth.openai.com/oauth/token`             | ✅ CORS 有効                                                                 |
| `chatgpt.com/backend-api/codex/responses` | ✅ Chrome 拡張は CORS 制約を受けない (manifest の `host_permissions` で許可) |

### manifest.json への追加

```json
{
  "host_permissions": ["https://chatgpt.com/*"]
}
```

既存の `host_permissions` に `chatgpt.com` を追加する必要がある。

## セキュリティ考慮

| リスク                     | 対策                                                            |
| -------------------------- | --------------------------------------------------------------- |
| Client ID の露出           | 公開値。Codex CLI, Roo Code 等と共通。難読化不要                |
| access_token の保存        | 既存の Copilot と同様、chrome.storage.local に保存              |
| accountId の漏洩           | chrome.storage.local は拡張ごとに隔離                           |
| PKCE verifier のメモリ残存 | login() 完了後にスコープを出て GC (既存実装のまま)              |
| リフレッシュ失敗時         | UI にエラー表示 + 再ログインを促す (既存の AuthProvider フロー) |

## 既知の制限

1. **利用可能モデルが限定される**: Codex 対応モデルのみ。モデル一覧は ChatGPT アカウントのプランに依存
2. **Responses API のみ**: Chat Completions API は Codex エンドポイントで利用不可
3. **Client ID の将来性**: OpenAI が第三者向け Client ID 発行の仕組みを整備する可能性あり。その場合は設定可能にする
4. **地域制限**: 一部の国/地域では Codex API にアクセスできない (403 エラー)

## 変更ファイル一覧

| ファイル                                       | 変更内容                                              |
| ---------------------------------------------- | ----------------------------------------------------- |
| `src/features/settings/provider-visibility.ts` | OpenAI の OAuth セクション表示を有効化                |
| `src/ports/ai-provider.ts`                     | `ProviderConfig` に `accountId` 追加                  |
| `src/adapters/auth/openai-auth.ts`             | スコープ・audience 追加、accountId 抽出ロジック修正   |
| `src/adapters/ai/provider-factory.ts`          | OpenAI OAuth 時に Codex エンドポイント + ヘッダー設定 |
| `src/orchestration/agent-loop.ts`              | `accountId` を ProviderConfig に渡す                  |
| `src/features/settings/OAuthSection.tsx`       | Codex API 経由の表示追加 (軽微)                       |
| `public/manifest.json`                         | `host_permissions` に `chatgpt.com` 追加              |

## 関連ドキュメント

- [AI Provider 詳細設計](./ai-provider-detail.md) - provider-factory, Adapter 内部
- [トークン管理 詳細設計](./token-management-detail.md) - AuthProvider 実装全般
- [AI接続設計 (アーキテクチャ)](../architecture/ai-connection.md) - 方針レベル
