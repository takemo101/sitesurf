# AI接続設計

## 設計方針

- AI 呼び出しは `ports/ai-provider.ts` で抽象化する
- 認証は `ports/auth-provider.ts` で抽象化する
- orchestration 層が `AIProvider` と tools / store をつなぐ
- system prompt と tool list は毎ターン **同じ条件**で組み立てる

## AIProvider Port

```ts
export interface AIProvider {
  streamText(params: StreamTextParams): AsyncIterable<StreamEvent>;
}
```

`streamText` は text / reasoning / tool-call 系イベントを返すだけで、
実際のツール実行は orchestration 層が担当する。

## AuthProvider Port

```ts
export interface AuthProvider {
  login(
    callbacks: AuthCallbacks,
    options?: LoginOptions,
  ): Promise<Result<AuthCredentials, AuthError>>;
  refresh(credentials: AuthCredentials): Promise<Result<AuthCredentials, AuthError>>;
  isValid(credentials: AuthCredentials): boolean;
}
```

OAuth 実装や HTTP 通信は `adapters/auth/` に閉じ込める。

## Adapter 実装

### AI

- `adapters/ai/vercel-ai-adapter.ts`
- `adapters/ai/provider-factory.ts`
- `adapters/ai/converters.ts`
- `adapters/ai/openai-codex-adapter.ts`

### Auth

- `adapters/auth/openai-auth.ts`
- `adapters/auth/copilot-auth.ts`
- `adapters/auth/noop-auth.ts`

## agent-loop の責務

`src/orchestration/agent-loop.ts` が次をまとめて行う。

1. system prompt を組み立てる
2. agent に公開する tool list を組み立てる
3. `aiProvider.streamText()` を呼ぶ
4. tool-call を受けて `ToolExecutor` を実行する
5. tool 結果を messages に戻して次ターンへ進む
6. context budget / compaction / retry / security middleware を適用する

## system prompt と tool surface の整合性

現在は次の 3 つを揃えて組み立てる。

### system prompt

`src/features/ai/system-prompt-v2.ts`

- base sections: `CORE_IDENTITY`, `REPL_PHILOSOPHY`, `SECURITY_BOUNDARY`, `COMPLETION_PRINCIPLE`
- optional skills section
- optional visited URLs section

### tool list

`src/features/tools/index.ts`

- `ALL_TOOL_DEFS`
- `getAgentToolDefs({ enableBgFetch })`

### REPL description

`src/features/tools/repl.ts` + `src/shared/repl-description-sections.ts`

- `AVAILABLE_FUNCTIONS`
- optional `COMMON_PATTERNS`
- `bgFetch()` に関する行内説明の表示/非表示

**重要:** `enableBgFetch` が効くのは **tool list と REPL description** であり、system prompt 本文はこのフラグで変化しない。

- `bg_fetch` tool を agent へ公開するか
- REPL description 内で `bgFetch()` を見せるか

この 2 つを必ず同時に切り替える。

## skills 注入方式

Issue #91 / #92 以降、skills は 2 層で扱う。

### 1. prompt への注入

`getSystemPromptV2({ includeSkills: true, skills })`

system prompt には以下のみを出す。

- skill 名
- description
- 利用可能 extractor の signature
- output schema
- `window.skillId.extractorId()` の使用例

**出さないもの**

- `extractor.code`
- `new Function(...)` による再構築例

### 2. sandbox runtime への注入

`src/features/tools/repl.ts`

- `formatSkillsForSandbox(matches)` が runtime object を構築
- ここでは `extractor.code` を保持する
- `executeRepl()` が sandbox に渡す
- page 側では `window.youtube.getVideoInfo()` のように呼べる

この分離により、**prompt から実装コードを外しつつ runtime capability は維持**している。

## fullStream イベント処理

Vercel AI SDK の `fullStream` から受け取る代表的なイベント:

- `text-delta`
- `reasoning-delta`
- `tool-input-start`
- `tool-input-delta`
- `tool-call`
- `finish`
- `error`

agent-loop は `tool-input-start/delta` をバッファし、完成した引数で tool を実行する。

## context 管理

### 1. ContextBudget

`features/ai/context-budget.ts`

- モデルごとの最大コンテキスト長を基に予算を配分
- text / image / tool-result を見積もる

### 2. 事前 compaction

`orchestration/context-manager.ts` + `context-compressor.ts`

- 古い履歴を構造化要約に置換
- unsummarized turn の tool 結果は再取得しない前提で使う

### 3. overflow retry

`orchestration/retry.ts`

- token overflow 系エラーを検出
- 追加圧縮して再試行

## security middleware

ツール出力（`read_page`, `repl`, `bg_fetch` など）は AI に返す前に security middleware を通る。

- prompt injection らしき文字列を検出
- 検出時は安全な要約に変換
- `enableSecurityMiddleware` 設定で制御

## テスタビリティ

この構成により次を保つ。

- `AIProvider` をモックに差し替えて stream イベントを再現できる
- prompt 生成を pure function としてテストできる
- tool list の gating と prompt 文言の一致を unit test で固定できる
- auth adapter を feature から切り離して検証できる

## 関連ドキュメント

- [概要](./overview.md)
- [パッケージ構成](./package-structure.md)
- [ツール設計](./tools.md)
- [システムプロンプト設計](../design/system-prompt.md)
- [AI Provider 詳細設計](../design/ai-provider-detail.md)
- [トークン管理 詳細設計](../design/token-management-detail.md)
