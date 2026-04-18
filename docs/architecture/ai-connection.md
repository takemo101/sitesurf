# AI接続設計

## 設計方針

**AI接続は `ports/ai-provider.ts` で抽象化し、具体実装を `adapters/ai/` に閉じ込める。**
**認証フローは `ports/auth-provider.ts` で抽象化し、具体実装を `adapters/auth/` に閉じ込める。**

## AIProvider Port

Portはドメインの要件（AIエージェントとしてテキスト生成する）から導出する。
Vercel AI SDK の API 形状に引きずられない。

```typescript
export interface AIProvider {
  streamText(params: StreamTextParams): AsyncIterable<StreamEvent>;
}
```

- `streamText` は `tool-call` イベントを返すだけ (ツール実行は orchestration 層)
- `onToolCall` コールバックは Port に含めない (SDK 実装パターンへの依存を避ける)
- **完全な型定義**: [AI Provider 詳細設計](../design/ai-provider-detail.md) を参照

### StreamTextParams と ReasoningEffort

```typescript
export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface StreamTextParams {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  reasoningEffort?: ReasoningEffort;
}
```

`reasoningEffort` はプロバイダーが対応している場合に「思考レベル」を指定する。
Settings store の `reasoningLevel` フィールドに対応し、UIのセレクトから設定できる。

## AuthProvider Port

```typescript
export interface AuthProvider {
  login(
    callbacks: AuthCallbacks,
    options?: LoginOptions,
  ): Promise<Result<AuthCredentials, AuthError>>;
  refresh(credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>>;
  isValid(credentials: AuthCredentials): boolean;
}

export interface LoginOptions {
  enterpriseDomain?: string;
}

export interface AuthCallbacks {
  /** Device Flow 用: ユーザーに表示するコード */
  onDeviceCode?: (info: { userCode: string; verificationUri: string }) => void;
}

export interface AuthCredentials {
  providerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  metadata?: Record<string, string>; // accountId 等
}
```

- `login()` の第2引数 `LoginOptions` はオプショナル。`enterpriseDomain` は GitHub Enterprise 向け
- **完全な型定義**: [トークン管理 詳細設計](../design/token-management-detail.md) を参照

## Adapter実装

### AI Adapter

```
adapters/ai/
├── vercel-ai-adapter.ts  # AIProvider の Vercel AI SDK 実装
└── provider-factory.ts   # 設定に応じた LanguageModel 生成
```

`ProviderConfig` 型は `ports/ai-provider.ts` で定義されている。
`provider-factory.ts` はそれを re-export しつつ、設定 (ProviderId, apiKey, oauthToken, baseUrl) を受け取り
Vercel AI SDK の `LanguageModel` を返す。プロバイダー固有のヘッダーやURL差異はここに閉じる。

| ProviderId  | SDK関数                    | 主な設定                                                                                                                                      |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `anthropic` | `createAnthropic`          | `apiKey`, `anthropic-dangerous-direct-browser-access` ヘッダー                                                                                |
| `openai`    | `createOpenAI`             | `apiKey` or OAuth token                                                                                                                       |
| `google`    | `createGoogleGenerativeAI` | `apiKey`                                                                                                                                      |
| `copilot`   | `createOpenAI`             | `baseURL: copilotEndpoint`, `apiKey: copilotToken`, Copilot headers, `client.chat(model)` で Chat Completions API を強制 (Responses API 回避) |
| `local`     | `createOpenAI`             | `baseURL: ollamaEndpoint`, `apiKey: "dummy"`                                                                                                  |

**Copilot のモデル ID**: Gemini モデルは `-preview` サフィックスが必要 (例: `gemini-2.0-flash-preview`)。

### Auth Adapter

```
adapters/auth/
├── openai-auth.ts   # OpenAI PKCE フロー (AuthProvider実装)
├── copilot-auth.ts  # GitHub Copilot Device Flow (AuthProvider実装)
└── noop-auth.ts     # APIキー方式・認証不要のnull実装
```

OAuthフローはChrome APIへの依存（`chrome.tabs.create`, `chrome.tabs.onUpdated`）と
HTTP通信（`fetch`）を含むため、**features/ ではなく adapters/ に配置する**。

`features/settings/` は `ports/auth-provider` 経由でログインを実行する。

**OAuth の対応状況**:

- GitHub Copilot OAuth (Device Flow): 有効
- OpenAI OAuth (PKCE): 有効 → [詳細設計](../design/openai-oauth-detail.md)

Store は Port の `AuthCredentials` 型をそのまま使用する（別途ストア型を定義しない）。

OAuth 成功時は `saveSettings()` で自動的にストレージへ永続化する。
ログアウト (Disconnect) 時も `saveSettings()` で永続化する。

### OpenAI PKCE フロー (`adapters/auth/openai-auth.ts`)

1. PKCE (code_verifier, code_challenge) を生成
2. `ports/browser-executor` 経由で認証URLのタブを開く
3. タブURL変更を監視しリダイレクトを検出
4. Token Endpoint に code + code_verifier を送信 (fetch)
5. `AuthCredentials` を返す

### GitHub Copilot Device Flow (`adapters/auth/copilot-auth.ts`)

1. `github.com/login/device/code` に POST → device_code, user_code 取得
2. `callbacks.onDeviceCode()` で UIに通知
3. `ports/browser-executor` 経由で verification_uri を新タブで開く
4. ポーリングで GitHub access_token を取得
5. Copilot token に交換
6. `AuthCredentials` を返す

### トークンリフレッシュ

- `handleSend` が AI 呼び出し前に `isValid()` を確認 (プロアクティブリフレッシュ)
- 無効なら `AuthProvider.refresh()` → 新トークンを `ports/storage` に保存
- リフレッシュ失敗時は `AppError` (type: `auth_expired`) を返し、UIが再ログインを促す

## ストリーミングとエージェントループ

`orchestration/agent-loop.ts` が AIProvider と features を仲介する。

エージェントループは **自己管理の while ループ**として実装されている (SDK の `maxSteps` は使わない)。

```
orchestration/agent-loop.ts
│
│ (1) ports/ai-provider.streamText()
▼
AsyncIterable<StreamEvent>
│
├─ text-delta           → features/chat の store: メッセージ内容を逐次更新
│
├─ tool-input-start     → ツール呼び出し開始 (execute なしツールのバッファリング開始)
├─ tool-input-delta     → ツール引数の逐次受信・バッファ更新
│
├─ tool-call (finish)   → features/tools で定義を参照
│                          → ports/browser-executor でツール実行
│                          → 結果を ToolResultMessage として messages に追加
│                          → (1) に戻って streamText を再呼び出し
│
├─ reasoning-delta      → 思考テキストの逐次更新 (thinking)
│
├─ finish               → features/chat の store: ストリーミング完了
│
└─ error                → features/chat の store: エラー表示
```

### fullStream イベントの扱い

Vercel AI SDK の `fullStream` から受け取るイベントは以下の点に注意する:

- **text-delta**: テキスト断片は `part.text` で取得する (`part.textDelta` ではない)
- **tool-input-start / tool-input-delta**: `execute` なしツールの呼び出しをバッファリングし、`finish` 後にまとめて実行する
- **reasoning-delta**: 思考テキスト (Claude の extended thinking 等) の逐次更新

### マルチターンループ

```typescript
while (true) {
  for await (const event of aiProvider.streamText({ model, messages, tools })) {
    if (event.type === "text-delta")      → chatStore に追記
    if (event.type === "tool-input-start") → ツールバッファ初期化
    if (event.type === "tool-input-delta") → ツールバッファ更新
    if (event.type === "tool-call")        → ツール実行、結果を messages に追加
    if (event.type === "reasoning-delta")  → 思考テキスト更新
    if (event.type === "finish")           → break
    if (event.type === "error")            → エラー処理、break
  }
  if (最後のターンでツール呼び出しがなければ) break; // ループ終了
}
```

### コンテキスト管理 (Wave 1-4)

コンテキスト超過を防ぐために以下の層で管理する:

1. **ContextBudget (`features/ai/context-budget.ts`)**: モデルごとの最大コンテキスト長から、システムプロンプト + ツール結果 + 履歴の予算を計算する。`estimateTokens` で text / tool / image / tool-call を個別にカウントする。
2. **ツール出力の静的切り詰め**: `maxToolResultChars` を超えるツール結果は送信前に切り詰める (`shared/truncate-utils`)。
3. **事前圧縮 (`orchestration/context-manager.ts` + `context-compressor.ts`)**: ContextBudget の閾値を超えると、古いメッセージを構造化要約 (`features/ai/structured-summary-prompt.ts`) に置き換える。要約済み部分は履歴から除去され、`[構造化要約]` マーカー付きでセッションに保存される。
4. **オーバーフローエラー回復 (`orchestration/retry.ts`)**: `isContextOverflowError()` で「token exceeds limit」系エラーを検出し、追加圧縮してリトライする。

`autoCompact` 設定が有効 (デフォルト) の場合、事前圧縮は自動で走る。keep-recent の閾値は文字数ではなくトークン数で管理する (Wave 2 で変更)。

## Chrome拡張固有の制約

### CORS

| エンドポイント        | CORS      | 対応                                                 |
| --------------------- | --------- | ---------------------------------------------------- |
| Anthropic API         | 制限あり  | `anthropic-dangerous-direct-browser-access` ヘッダー |
| OpenAI Token Endpoint | 有効      | 直接呼び出し                                         |
| GitHub API            | 有効      | 直接呼び出し                                         |
| ローカルLLM           | localhost | 問題なし                                             |

### Service Worker の寿命

- AI API呼び出しは Side Panel (常駐) から行い、Background は経由しない
- ストリーミング中にService Workerが停止しても影響なし

## 関連ドキュメント

- [概要](./overview.md) - 全体アーキテクチャ
- [パッケージ構成](./package-structure.md) - adapters/ の配置
- [状態管理設計](./state-management.md) - 認証情報の永続化
- [ツール設計](./tools.md) - ストリーミング中のツール呼び出し
- [エラーハンドリング](./error-handling.md) - `AppError` 型

### 詳細設計

- [AI Provider 詳細設計](../design/ai-provider-detail.md) - Port型定義、Adapter内部、provider-factory
- [トークン管理 詳細設計](../design/token-management-detail.md) - AuthProvider実装、ライフサイクル、連携フロー
