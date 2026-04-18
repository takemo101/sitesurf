# ツール結果コンテキスト管理 v2

> ⚠️ **HISTORICAL（参考資料）** — 本ドキュメントが述べる Layer 3（`ToolResultStore` / `get_tool_result` の pull-retrieval）は、実運用で pi-mono 方式（LLM による auto-compaction）へ方針変更した結果、Phase 2 rollback で削除されました（PR #69）。
>
> **現行の実装と最終仕様**:
>
> - **Layer 1（計測 & Budget）**: `src/features/ai/context-budget.ts` の `ContextBudget`、`src/shared/token-utils.ts` の `estimateTokens` として実装済み。`useToolResultStore` フィールドは存在しない（Layer 3 削除に伴い不要化）。
> - **Layer 2（軽量介入）**: 訪問URL追跡 + 2段階 truncate。`agent-loop.ts` の `trackVisitedUrl` / `pruneVisitedUrls`、`context-manager.ts` の `truncateToolResult`。URL 再訪問の閾値警告は撤廃（同一 URL を正当に何度も参照するワークフローを尊重）。
> - **Layer 3（Store + get_tool_result）**: 削除済み。旧セッション履歴に残る `Stored: tool_result://` / `Use get_tool_result(...)` 行は `agent-loop.ts:LEGACY_*_RE` で読み込み時に剥がされる。
> - **Layer 4（LLM 構造化圧縮）**: `compressMessagesIfNeeded` として実装。先頭に `[構造化要約]\n...` を持つ `user` メッセージを差し込むローリング要約方式。`KEEP_RECENT_TOKENS = 20_000`（メッセージ数ではなくトークン数で末尾を保持）。`autoCompact` のデフォルトは **`true`**（クラウドでも自動圧縮）。
> - **Layer 5（UI）**: ツール結果の auto-collapse / 展開（Wave 4）。`get_tool_result` の展開ボタンは Layer 3 と一緒に廃止。
>
> 以降の章は Layer 3 を含む当初構想として残しておくが、**実装の正は `src/orchestration/context-{compressor,manager}.ts` と `src/features/ai/context-budget.ts`**。新規変更時はそちらを基点にすること。
>
> 新規読者は次の節（# 5.5 現行アーキテクチャ概要）から読むのが早い。

## 1. 概要

### 1.1 問題再定義

- 32k コンテキスト窓モデルでツール2-3回呼ぶと AI が過去のツール結果を「忘れる」
- 根本原因は (a) ツール結果の履歴直載せ (b) `estimateTokens` が tool 結果を数えない (c) 溢れた時の粗い splice (d) ハードコードの閾値
- **マルチプロバイダで動作する必要がある**（Anthropic 専用解は避ける）
- **大窓モデル利用者に overhead を強いない必要がある**（過剰介入を避ける）

### 1.2 v1 からの主な変更点

| 変更                         | v1                       | v2                                                                 |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------ |
| 構造                         | Phase 0-7 のフラット列挙 | **5層 + 4段階リリース**                                            |
| 窓サイズ適応                 | Budget で閾値のみ動的    | **層3以降は窓サイズで ON/OFF**                                     |
| URL 訪問追跡 / 構造化要約    | 未反映                   | **導入**                                                           |
| **Anthropic Prompt Caching** | Phase 7 で導入予定だった | **削除**（マルチプロバイダ汎用性優先、単一プロバイダ依存を避ける） |
| LLM 要約プロンプト           | 汎用要約                 | **Goal/Progress/Decisions の構造化**                               |
| リリース単位                 | 全 Phase 一括設計        | **段階的・計測主導**                                               |

### 1.3 設計原則（v2）

1. **履歴とストアを分離** — 完全結果は保存、履歴は要約のみ（小窓時）
2. **計測を正確に** — `estimateTokens` に tool 結果と画像を含める
3. **モデル窓に適応** — 層ごとに ON/OFF を切替
4. **情報損失は段階的に** — 通常 → 要約 → LLM圧縮 → splice
5. **マルチプロバイダで対等に動く** — **単一プロバイダでしか効かない機能は設計から除外**。OpenAI/Google/ローカル/Anthropic すべてで同じ体験を提供
6. **段階リリースで計測主導** — 次の層を作る前に前の層の効果を確認

---

## 2. 設計の層構造

```
┌─────────────────────────────────────────────────────────┐
│ Layer 5: UI                                            │
│   ツール結果の展開ボタン、設定UI                         │
├─────────────────────────────────────────────────────────┤
│ Layer 4: LLM 構造化圧縮                                │
│   Goal/Progress/Decisions のローリング要約             │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Web 拡張固有の永続化（sitesurf 固有強み）     │
│   ToolResultStore + Summarizer + get_tool_result       │
├─────────────────────────────────────────────────────────┤
│ Layer 2: 軽量な介入（全プロバイダ対応）                │
│   URL訪問追跡 + 2段階truncate                          │
├─────────────────────────────────────────────────────────┤
│ Layer 1: 計測 & Budget（基盤）                         │
│   estimateTokens v2・ContextBudget・動的 truncate      │
└─────────────────────────────────────────────────────────┘
```

**全層プロバイダ非依存**: 各層は Anthropic / OpenAI / Google / ローカルすべてで同じ動作。単一プロバイダでのみ動く機能（例: Anthropic の `cache_control`）は設計から除外。

### 2.1 層間の依存関係

- **Layer 1 は全層の前提**（計測なしに他層は機能判定できない）
- **Layer 2 は Layer 1 に依存**（Budget を参照）
- **Layer 3 は Layer 1/2 と独立に有効化可能**（ただし Layer 1 の計測データで要否判断）
- **Layer 4 は Layer 1 に依存**（Budget の閾値超過で発動）
- **Layer 5 は Layer 3 の UI**（Layer 3 無しでは無意味）

---

## 3. 適用マトリクス

### 窓サイズ別の有効層

| 構成                            | L1  | L2 URL追跡 | L2 truncate | L3                    | L4                     | L5  |
| ------------------------------- | --- | ---------- | ----------- | --------------------- | ---------------------- | --- |
| **小窓 < 40k**                  | ✓   | ✓          | ✓           | **✓（主効果）**       | ○                      | ✓   |
| **中窓 40-80k**                 | ✓   | ✓          | ✓           | ○（option）           | ○                      | ✓   |
| **大窓 ≥ 80k**                  | ✓   | ✓          | ✓           | **✗**（overhead回避） | ✗                      | -   |
| **ローカル/Ollama（小モデル）** | ✓   | ✓          | ✓           | 窓による              | △（LLM要約は品質注意） | -   |

（✓=有効、○=ユーザー設定で有効化、△=条件付き、✗=無効）

**プロバイダ別の差は設計に含めない**。Anthropic/OpenAI/Google のどのプロバイダを使っても、同じ層構造が同じように動作する。

### 主効果の担い手

- **マルチプロバイダ共通の「忘れない」本体**: Layer 2 (URL追跡) + Layer 3 (Store + Summarizer)
- **超長期セッション**: Layer 4 (LLM 圧縮)

---

## 4. 他エージェントとの比較

| 観点             | Claude Code               | 別の Web AI 拡張          | **sitesurf v2**                                   |
| ---------------- | ------------------------- | ------------------------- | ------------------------------------------------- |
| 主戦略           | auto-compact + 完全版保持 | トリム無し + artifact避難 | **層構造（窓サイズ適応）**                        |
| 完全版保持       | **あり**（履歴に残す）    | あり（履歴）              | **あり（Store）**                                 |
| 完全版の再取得   | 再実行                    | 履歴から                  | **pull（get_tool_result）**                       |
| 要約の質         | LLM 要約（分析＋要約）    | なし                      | **ルール + LLM ハイブリッド**                     |
| Prompt Caching   | 3箇所 + 1h TTL            | 未調査                    | **採用せず**（プロバイダ汎用性優先）              |
| マルチプロバイダ | Anthropic 特化            | Vercel AI SDK             | **Vercel AI SDK + 層ごと ON/OFF、プロバイダ不問** |
| サブエージェント | fork + キャッシュ共有     | なし                      | **将来検討**                                      |
| 永続メモリ       | CLAUDE.md 階層            | なし                      | **artifact（既存）**                              |

### sitesurf v2 の独自性

- **窓サイズで層を切り替え**: Claude Code は 200k 前提で完全版保持。v2 は「持たざるモデルは軽く、持つモデルは重く」
- **Web 拡張特化の Store**: 一般のコーディングエージェントは「再 Read できる」前提だが、sitesurf は「Web 状態は再現不可能」（ログイン・動的コンテンツ・有効期限付きトークン）→ Store 保持が本質的に必要
- **ルール要約 + LLM 要約のハイブリッド**: 個別ツール結果はルール（安価・同期）、セッション全体は LLM（構造化）
- **プロバイダ中立**: Prompt Caching のようなプロバイダ固有機能に依存せず、単一プロバイダ依存を避けて**全ユーザーで同じ体験**を実現

---

## 5. 各層の詳細仕様

### Layer 1: 計測 & Budget

#### D-L1-1: `estimateTokens` v2

`role: "tool"` の `result` フィールド、画像、tool-call args をカウントする。

```typescript
// src/shared/token-utils.ts
export function estimateTokens(messages: AIMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (msg.role === "tool") {
      chars += msg.result.length; // 新規
    } else if ("content" in msg && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ("text" in part && part.text) {
          chars += part.text.length;
        } else if (part.type === "image") {
          chars += 6000; // 新規: ~1500 tokens
        } else if (part.type === "tool-call") {
          chars += JSON.stringify(part.args).length; // 新規
        }
      }
    }
  }
  return chars;
}
```

#### D-L1-2: `ContextBudget`

```typescript
// src/features/ai/context-budget.ts
export interface ContextBudget {
  windowTokens: number;
  outputReserve: number;
  inputBudget: number;
  maxToolResultChars: number;
  compressionThreshold: number; // Layer 4 発動閾値
  trimThreshold: number; // Splice 発動閾値
  useToolResultStore: boolean; // Layer 3 ON/OFF（窓サイズ判定）
}

export function getContextBudget(model: string, settingsMaxTokens?: number): ContextBudget {
  const windowTokens = lookupModelContextWindow(model);
  const requestedOutput = settingsMaxTokens ?? DEFAULT_MAX_TOKENS;
  const outputReserve = Math.min(requestedOutput, Math.floor(windowTokens * 0.5));
  const inputBudget = windowTokens - outputReserve;

  return {
    windowTokens,
    outputReserve,
    inputBudget,
    maxToolResultChars:
      inputBudget >= 150_000
        ? 20_000
        : inputBudget >= 80_000
          ? 10_000
          : inputBudget >= 40_000
            ? 4_000
            : inputBudget >= 20_000
              ? 2_000
              : 1_000,
    compressionThreshold: Math.floor(inputBudget * 0.6),
    trimThreshold: Math.floor(inputBudget * 0.85),
    useToolResultStore: inputBudget < 80_000, // 大窓では無効
  };
}
```

**maxTokens クランプ**: `Math.min(maxTokens, windowTokens * 0.5)` で安全側クランプ。発生時は `log.info` 出力。

#### D-L1-3: 動的 `maxToolResultChars`

`agent-loop.ts:96-97` のハードコードを `budget.maxToolResultChars` に差し替え。`CONTEXT_TOKEN_LIMIT * 0.7` (551行) は `budget.compressionThreshold` に。

#### D-L1-4: `COMPRESS_THRESHOLDS` 統合

`context-compressor.ts` の `COMPRESS_THRESHOLDS` は廃止、`budget.trimThreshold` 一元化。

#### D-L1-5: 計測項目リスト（段階リリース判断用）

Layer 1 実装時に以下の指標を `log.info` で記録し、telemetry として残す。これらは第2弾・第3弾の発動判定に使う。

| 指標                       | 取得タイミング     | 用途                    |
| -------------------------- | ------------------ | ----------------------- |
| `windowTokens`             | ストリーム開始時   | 使用モデル窓の分布把握  |
| `inputBudget`              | ストリーム開始時   | 実効入力枠の分布        |
| `estimateTokens(messages)` | 各ターン開始時     | 使用率の変化            |
| `currentSessionTurnCount`  | 各ターン開始時     | セッション長分布        |
| `trimThreshold reached`    | 超過検知時         | トリム発火率            |
| `splicedMessageCount`      | splice 実行時      | 情報損失量              |
| `visitedUrl revisit count` | URL再訪問検知時    | ループ発生頻度          |
| `contextOverflowError`     | プロバイダエラー時 | 実 API オーバーフロー率 |

これらは既存の `logger` 経由で出力。取得先（sentry等）は別途設計するが、本設計では `log.info` までで十分。

---

### Layer 2: 軽量な介入（全プロバイダ対応）

#### D-L2-1: URL 訪問追跡 + system prompt 注入

コーディングエージェントがファイル操作履歴（read/write/edit の履歴）を継続追跡するのと同じ発想で、sitesurf は **URL の訪問履歴** を session-scoped に追跡し、system prompt に動的注入する。

**軽量版に絞る（Oracle指摘反映）**: overhead を最小化するため、要約は載せず URL + title + visitCount のみ。詳細要約は L3 の履歴要約側に委ねる（二重持ちを避ける）。

```typescript
interface VisitedUrlEntry {
  url: string;
  title: string;
  visitedAt: number;
  visitCount: number;
  lastMethod?: "navigate" | "read_page" | "bg_fetch"; // どのツール経由か
}

// system prompt 注入テンプレ（URL 1件あたり ~80-100字）
`
## Current Session: Visited URLs
${visitedUrls
  .map((e) => `- ${e.url} (${e.title}) [${e.visitCount}x, via ${e.lastMethod ?? "navigate"}]`)
  .join("\n")}
`;
```

既存の `visitedUrls` Map（`agent-loop.ts` の `visitedUrls` 定義）を拡張。効果：

- AI が「同じ URL をまた読もうとする」ループを抑制
- 全プロバイダで効く（LLM コスト無し、system prompt への追記のみ）
- 層3 が無効な大窓モデルでも、この追跡情報は system prompt に残る

**overhead 試算**:

- 1 URL ~90字 × 20 URL = **~1,800字（~450 tokens）**
- 32k 窓で入力予算の 1.5% 程度（Oracle 指摘の 6-10% から圧縮）

**サイズ管理**: 20 URL 超過時は visitCount が少なく・古いエントリから順に切り捨て。

#### D-L2-2: ツール結果の2段階 truncate

- **第1段階**: ツール実行直後、`budget.maxToolResultChars` で truncate（Layer 1 の Budget 由来）
- **第2段階**: Layer 4 の圧縮プロンプトに流す際、`TOOL_RESULT_MAX_CHARS = 2000` で再 truncate（LLM への入力過大防止）

---

### Layer 3: Web 拡張固有の永続化

**sitesurf 固有価値**: 一般のコーディングエージェントは「再 Read できる」前提だが、Web は「その時の状態」（ログイン・動的コンテンツ・有効期限付きトークン）が再実行で取り戻せない。→ **完全版保持 + pull 取得は本質的に必要**。

**ただし**: 大窓モデル（≥80k）ではオーバースペック。`budget.useToolResultStore` で ON/OFF 切替。

#### D-L3-1: `ToolResultStore`

```typescript
// src/ports/tool-result-store.ts
export interface StoredToolResult {
  key: string;
  sessionId: string;
  toolName: string;
  fullValue: string;
  summary: string;
  createdAt: number;
  turnIndex: number;
}

export interface ToolResultStorePort {
  save(sessionId: string, result: Omit<StoredToolResult, "createdAt" | "sessionId">): Promise<void>;
  get(sessionId: string, key: string): Promise<StoredToolResult | null>;
  list(sessionId: string): Promise<StoredToolResult[]>;
  deleteSession(sessionId: string): Promise<void>;
}
```

**v1 からの変更**: `setSessionId` in-memory state を廃止、メソッド引数で sessionId を直接渡す（Oracle 指摘の複数タブ race 対策）。

Adapter: `src/adapters/storage/indexeddb-tool-result-store.ts`（既存 IndexedDB 基盤を再利用）。

#### D-L3-2: `ResultSummarizer`（ツール別ルールベース）

| toolName             | 要約内容                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `read_page`          | `H1: {h1} / URL: {url} / method: {method} / 本文先頭200字`        |
| `bg_fetch`           | `Fetched {n} URL(s): {url+title一覧} / success: {n}/fail: {n}`    |
| `repl` / `browserjs` | `return type: {typeof} / value preview(200字) / console(末尾3行)` |
| `navigate`           | `→ {finalUrl} (status: {status})`                                 |
| `artifacts.get`      | `{filename} ({sizeBytes} bytes)`                                  |
| screenshot           | `[screenshot captured]`                                           |
| error                | `ERROR: {code} {message(先頭120字)}`                              |

全要約は 300 文字以内（超過時は truncate）。**LLM コスト無し・同期・決定論的**。

#### D-L3-3: `shouldStore` 判定

以下の場合は Store に保存せず履歴に要約のみ残す（参照行なし）：

```typescript
export function shouldStore(input: {
  toolName: string;
  fullResult: string;
  summary: string;
  isError: boolean;
}): boolean {
  if (input.isError) return false;
  if (input.fullResult === "[screenshot captured]") return false;
  if (input.fullResult.length < 500) return false; // 短い
  if (input.fullResult.length - input.summary.length < 200) return false; // ≒要約
  return true;
}
```

**コスト**: 同期・O(n) 文字列操作のみ。summary は履歴フォーマットに必要なので使い回し。

#### D-L3-4: `get_tool_result` ツール

```typescript
export const getToolResultDef: ToolDefinition = {
  name: "get_tool_result",
  description:
    "Retrieve the full content of a previous tool result by its key. " +
    "Keys are referenced in tool result summaries as 'tool_result://<key>'. " +
    "The retrieved content will revert to summary form after 1 turn.",
  parameters: {
    type: "object",
    properties: { key: { type: "string" } },
    required: ["key"],
  },
};
```

**動的登録**: `budget.useToolResultStore === false`（大窓）の時は **ツール定義自体を配信しない**。`DEFAULT_TOOLS` のビルド時に `budget.useToolResultStore` で分岐。

#### D-L3-5: N=1 再置換ルール

`get_tool_result` の結果は 1 ターン後に Summarizer の要約に戻す。これにより「取りに行った直後のターンでは完全版を使えて、それ以降は縮退」という自然な挙動。

**判定マーカー**:

- `Stored: tool_result://` 行の有無で新形式 or 旧形式を識別
- `Stored:` 行なし → D-L3-3 でスキップされた結果、再置換対象外

`N` は `context-manager.ts` 内の定数。

#### D-L3-6: 履歴メッセージフォーマット

**Store 保存あり**:

```
[read_page #3]
H1: "SiteSurf"
URL: https://example.com/
Method: main
Body preview: Welcome to SiteSurf...
Stored: tool_result://tc_abc123
Use get_tool_result("tc_abc123") for full content.
```

**Store 保存なし（shouldStore=false）**:

```
[navigate]
→ https://example.com/ (status: 200)
```

---

### Layer 4: LLM 構造化圧縮

#### D-L4-1: 構造化セッション要約

構造化フォーマット：

```
## Goal
{ユーザーが達成したいこと}

## Constraints & Preferences
{制約・好み}

## Progress
### Done
- {完了した項目}
### In Progress
- {進行中}
### Blocked
- {ブロック中}

## Key Decisions
- {採用した方針・却下した方針}

## Next Steps
- {次やるべきこと}

## Critical Context
- {失うと致命的な情報：URL、トークン、キー情報等}

## Visited URLs
{L2-1 からコピー、最新状態を記録}
```

**空セクション省略ルール**: 対応する情報が無いセクションは出力から省略する（見出しも出さない）。すべての見出しを固定出力すると、短いセッションでも 7 見出し × ~12字 = ~80 tokens の固定 overhead が発生する。プロンプトに「該当情報がないセクションは出力しないこと」を明示。

LLM に「既存要約 + 新規履歴」を入力として与え、更新版を返させる（ローリング要約）。

#### D-L4-2: ローリング要約

`session.summary` を維持し、次回圧縮時には前回要約を LLM に渡して更新させる。情報の継続的蓄積が可能。

#### D-L4-3: `compressMessagesIfNeeded`

既存 `compressIfNeeded` (Session-based) を薄いラッパーとして残しつつ、新規 `compressMessagesIfNeeded(messages: AIMessage[], ...)` を追加：

- 入力: AIMessage[] の配列
- 出力: 要約済み配列（先頭に構造化要約メッセージ、末尾に最近のメッセージ）

#### D-L4-4: `userConfirmed` ポリシー

- ローカル/ollama: デフォルト ON（自動実行）
- クラウド: ユーザー設定で有効化したときのみ ON（`settings.autoCompact: boolean`）
- デフォルト: クラウドで OFF（LLM コストを無断発生させない）

---

### Layer 5: UI（Optional）

#### D-L5-1: ツール結果展開ボタン

- `ChatBubble.tsx` / `ToolCallBlock.tsx` の新形式 result に「完全結果を展開」ボタン
- クリックで `ToolResultStore.get(sessionId, key)` → モーダル表示

#### D-L5-2: 設定 UI

- 「クラウドで自動圧縮」toggle — `autoCompact` 設定（Layer 4 の userConfirmed ポリシー用）

---

## 5.5 現行アーキテクチャ概要（実装済み・SSOT）

> 本節は v0.1.3 以降に確定した実装の要約。ここより上の Layer 3 詳細仕様は採用していない。

### モジュール構成

| モジュール                                     | 役割                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/shared/token-utils.ts`                    | `estimateTokens`（tool 結果・画像・tool-call args をカウント）                                                        |
| `src/features/ai/context-budget.ts`            | `getContextBudget(model, maxTokens)`：5階層の `maxToolResultChars` と `compressionThreshold` / `trimThreshold` を返す |
| `src/orchestration/context-manager.ts`         | ターン開始時の正規化・truncate・必要時の圧縮呼び出し（`prepareMessagesForTurn`）と `splice` フォールバック            |
| `src/orchestration/context-compressor.ts`      | `compressMessagesIfNeeded`：構造化要約の生成。`splitByKeepRecentTokens` で末尾20kトークン分を保持し残りを LLM に渡す  |
| `src/features/ai/structured-summary-prompt.ts` | 構造化要約のシステムプロンプト & ユーザ入力ビルダ                                                                     |

### `ContextBudget` 階層（実装値）

| `inputBudget`    | `maxToolResultChars` |
| ---------------- | -------------------- |
| ≥ 150,000        | 20,000               |
| 80,000 – 149,999 | 10,000               |
| 40,000 – 79,999  | 4,000                |
| 20,000 – 39,999  | 2,000                |
| < 20,000         | 1,000                |

`compressionThreshold = inputBudget * 0.6`、`trimThreshold = inputBudget * 0.85`。`outputReserve` は `min(settings.maxTokens, windowTokens * 0.5)` でクランプし、超えた場合は `log.info` に記録。

### 圧縮フロー

```
prepareMessagesForTurn(messages, budget, ...)
  ├─ normalizeContextMessages: tool 結果を maxToolResultChars に切り詰め
  ├─ estimateTokens(messages) < trimThreshold ? → そのまま返す
  ├─ compressMessagesIfNeeded
  │   ├─ provider が cloud かつ autoCompact=false → 圧縮しない
  │   ├─ splitByKeepRecentTokens(messages, 20_000): 末尾 20k tokens 相当を toKeep に
  │   ├─ summarizeMessages: 既存 summary + toCompress を構造化要約 LLM に渡し、新 summary を生成
  │   └─ 返り値: [構造化要約 user メッセージ, ...toKeep]
  └─ 圧縮できなかった場合 → trimMessagesToThreshold で古い tool/assistant を splice
```

- 構造化要約は `[構造化要約]\n` プレフィックス付きの `user` メッセージとして履歴先頭に保持。
- 圧縮が走らなかった場合は LLM 呼び出しを発生させない（コスト保護）。
- ターン跨ぎでは「既存要約 + 新規履歴」を入力に渡し、ローリング更新する。
- セッション永続化前に `toPersistedHistory` が `[構造化要約]` 行と `Stored: tool_result://` 系の旧マーカーを除去する。

### `autoCompact` のポリシー

| プロバイダー    | デフォルト | 動作                                     |
| --------------- | ---------- | ---------------------------------------- |
| ローカル/Ollama | 常時 ON    | `autoCompact` の値に関係なく圧縮を実行   |
| クラウド        | `true`     | UI トグル（システム設定）で OFF にできる |

> v0.1.3 時点ではクラウドの autoCompact デフォルトは OFF だったが、PR #66 で **ON に変更**。LLM 呼び出しコストよりも「忘れない」を優先する判断。OFF にしたい場合は設定 → システムから無効化できる。

### 削除された機能（v0.1.3 以降）

- `ToolResultStore` Port / `IndexedDBToolResultStore` Adapter（PR #69）
- `get_tool_result` ツール（PR #69）
- `result-summarizer.ts`（ルールベースのツール別要約）
- `useToolResultStore` フィールド（`ContextBudget` から削除）
- URL 再訪問の閾値警告（PR #75）

代わりに、構造化要約が「忘れない」の主担当となり、ツール結果は履歴にそのまま残しつつ Layer 1 の `maxToolResultChars` で動的に切り詰める。

---

## 6. 実装順序（4段階リリース）

各段階は**独立リリース可能**で、前段階の計測結果から次の発動要否を判断する。

### 🚀 第1弾: 基盤 + 軽量介入（3-5日、全プロバイダ対応）

**含まれる**:

- Layer 1 全部（L1-1 〜 L1-4）
- Layer 2 全部（L2-1 URL追跡、L2-2 2段階 truncate）

**目標効果**:

- 32k: 2-3 → **6-10 ターン持続**（全プロバイダ共通）
- 全プロバイダで URL ループ抑制
- 大窓: overhead ゼロ

**実装コード量**: ~500 行（新規コード + 既存置き換え）

**作業手順**:

1. `token-utils.ts` 改修（L1-1）
2. `context-budget.ts` 新規（L1-2）
3. `agent-loop.ts` のハードコード差し替え（L1-3, L1-4）
4. `visitedUrls` 拡張 + system prompt 注入（L2-1）
5. 2段階 truncate 実装（L2-2）
6. テスト: 各層の単体 + 統合

### 📦 第2弾: Web 拡張固有の永続化（2-3週、小窓特化）

**含まれる**:

- Layer 3 全部（L3-1 〜 L3-6）

**発動条件（定量化）**:

- `windowTokens < 40_000` のユーザーが DAU の **20% 以上**
- **かつ** 10 ターン超のセッションが全セッションの **15% 以上**
- **または** `trimThreshold reached` が全セッションの **10% 以上**

このいずれかが Wave 1 の2週間運用で確認されたら第2弾発動。

**目標効果**:

- 32k: 6-10 → **15-20 ターン持続**
- Web 状態の長期保持（`get_tool_result` で pull）

**実装コード量**: ~1500 行

**作業手順**:

1. `tool-result-store.ts` (Port) + `indexeddb-tool-result-store.ts` (Adapter)
2. `result-summarizer.ts` + `shouldStore` 判定
3. `get_tool_result` ツール + 動的登録
4. `executeToolCall` 改修（Summarizer 経路、Store 分岐）
5. `context-manager.ts` 新規（現 `trimMessagesForContext` 置き換え、Step A/B/D）
6. 新旧メッセージフォーマットの統合テスト

### 🧠 第3弾: LLM 構造化圧縮（1-2週、超長期セッション向け）

**含まれる**:

- Layer 4 全部（L4-1 〜 L4-4）

**発動条件（定量化）**:

- 第2弾導入後も `trimThreshold reached` が全セッションの **5% 以上**残る
- **または** 50+ ターンの超長期セッションで情報損失クレームが観測される

このいずれかが第2弾の1ヶ月運用で確認されたら第3弾発動。

**目標効果**:

- 超長期セッション持続（100+ ターン）
- 構造化要約で情報欠損最小化

**実装コード量**: ~500 行

**作業手順**:

1. 構造化要約プロンプト設計（L4-1）
2. `compressMessagesIfNeeded(messages, ...)` 新設（L4-3）
3. 既存 `compressIfNeeded` を薄いラッパーに退化
4. `context-manager.ts` の Step C として統合
5. userConfirmed 設定 UI（L4-4）

### 🎨 第4弾: UI（任意、別 PR）

**含まれる**:

- Layer 5 全部

---

## 7. Phase 0 スパイク（第2弾の前提検証）

**目的**: Layer 3 実装前に SDK の実挙動を確認し、設計の前提が妥当か検証する。

### スパイク項目

1. **（L3 前提）** `tool_use_id` / `toolCallId` に紐づく `tool_result.content` を後から書き換えて次の API 呼び出しに渡した場合の挙動（Anthropic / OpenAI / Google / ローカル）
2. **（L3 前提）** Vercel AI SDK の `toSDKMessages` が tool_result の後書き換えを透過的に許容するか、それとも特殊処理があるか

**期限**: 1 日。第2弾の先頭で実施（第1弾は SDK 挙動に依存しないためスパイク不要）。

**フォールバック**: スパイクで「tool_result 差し替え不可」と判明した場合、L3 のフォーマットは「tool_result は完全版 / 要約は続く user メッセージに prepend」に切り替える。設計骨格（Store / Summarizer / Budget / 4層構造）は維持。

---

## 8. テスト戦略

### 層別テスト

**Layer 1**:

- `estimateTokens` が tool/image/tool-call を正しくカウント（各種 shape のメッセージで）
- `ContextBudget` が窓サイズ × maxTokens の組合せで期待値を返す
- maxTokens クランプのログ出力

**Layer 2**:

- URL追跡が system prompt に正しい形で注入される
- 20 URL 超過時の切り捨てロジック
- 2段階 truncate の閾値動作

**Layer 3**:

- `shouldStore` の境界ケース（500字、200字差分）
- `ToolResultStore` の sessionId 分離（複数タブ想定）
- 新旧フォーマットの判別
- `get_tool_result` が大窓では tools に含まれない

**Layer 4**:

- 構造化要約プロンプトの出力形式
- ローリング要約の情報継承
- userConfirmed のポリシー遵守

### 意味ベース assertion（横断）

- 32k モデルで 20 ターン回したとき、`ターン間 estimateTokens 増分中央値 ≤ 800 chars`
- Step D (splice) が最初の 15 ターン以内に発火しない
- 5 ターン目時点で 1-4 ターン目の `tool_result://` 参照が要約として生存
- `ToolResultStore.get()` が保存済みキーで完全結果を返す

---

## 9. 既知の制約・リスク

### 設計由来

- **旧セッションの救済限界**: v1 同様、旧形式セッションは現状踏襲（migration なし）
- **N=1 再置換の実運用**: AI が再 `get_tool_result` を連打する挙動は Phase 3 のドッグフーディングで system prompt 調整前提
- **大窓ユーザーの UX 変化ほぼ無し**: 層3以降が無効のため、現状維持に近い動作。「忘れない」改善は L1/L2 分のみ（十分に小窓の改善が主眼）

### プロバイダ由来

- **Prompt Caching は意図的に不採用**: 単一プロバイダ依存を避けるため、Anthropic の `cache_control` や Google の明示キャッシュは使用しない。OpenAI の自動キャッシュは介入せず自動任せ
- **OpenAI 自動キャッシュへの影響**: Layer 3 の履歴書き換えで prefix 一致キャッシュが副次的に無効化される。具体的には D-L3-5 の N=1 再置換と `Stored:` 参照行の更新で毎ターン prefix が変わる。
  - **推定影響**: OpenAI 自動キャッシュヒット率が通常 50-80% → Layer 3 有効時 10-20% まで低下する可能性
  - **コスト影響**: 長期セッションで **2-4 倍**のコスト増加の可能性
  - **緩和策**: (a) ユーザーが大窓モデル（Layer 3 無効化）を選べばキャッシュ影響なし、(b) 将来 Layer 6 として「書き換えない末尾キャッシュ保護」を追加する余地あり
  - **設計判断**: 挙動自体は壊れない（キャッシュは cost/latency 最適化のみ）ため本設計では許容、ただしテレメトリで監視する
- **プロバイダによる実効ターン数の差**: どのプロバイダでも同じ層が同じ閾値で動く。窓サイズ差が実効ターン数を決める

### 運用由来

- **IndexedDB 容量超過**: `deleteSession` でセッション単位でクリーンアップ。グローバル容量監視は別設計
- **ローカルモデルの LLM 要約品質**: Layer 4 はローカルモデル利用時も動作するが、小モデルでの構造化要約精度に制約あり。その場合は Layer 4 を OFF 推奨

---

## 10. 移行計画（v1 設計書からの差分）

### 保持される内容（v1 と同じ）

- estimateTokens 改修の方向性（tool/image/args カウント）
- ContextBudget の基本式
- ToolResultStore + Summarizer の基本概念
- shouldStore 判定ロジック
- `get_tool_result` ツール
- Phase 0 スパイクの必要性
- **v1 D2 相当**: Store と artifact は別 namespace（`tool_result://` vs artifact filename）
- **v1 D4 相当**: UI は tool call bubble 内に展開ボタン、Artifact Panel には出さない（L5-1 で再掲）
- **v1 D5 相当**: `get_tool_result` のスコープは現セッションのみ（全セッション横断しない）

### 変更される内容（v2 で改訂）

| v1                            | v2                                          |
| ----------------------------- | ------------------------------------------- |
| Phase 0-7 のフラット構造      | Layer 1-5 + 4段階リリース                   |
| 大窓でも Phase 3/4 を強制適用 | `useToolResultStore` で窓サイズ分岐         |
| 汎用要約プロンプト            | **構造化要約（Goal/Progress/Decisions）**   |
| URL ループは 6 回閾値警告のみ | **訪問URL+要約を system prompt に定期注入** |
| 全 Phase を一括意思決定       | **段階的計測主導**                          |

### 削除される内容

- **Phase 7 (Anthropic Prompt Caching)**: 単一プロバイダ依存を避けるため、設計から完全に除外
  - `cache_control` 付与、1h TTL、`longLivedCache` 設定、`converters.ts` の Anthropic 分岐、`vercel-ai-adapter.ts` の system multi-part 化、すべて不採用
  - **永久凍結ではない**: 「Layer 6: プロバイダ個別最適化層」として将来別設計で再導入可能。本設計の Layer 1-5 とは完全に独立（直交）
  - 再導入の判断基準: Wave 1 運用後の計測で「Anthropic ユーザーのコスト増加が明らかに不満要因となった」場合
  - 再導入時の想定効果: system + tools キャッシュで入力の 15-20% 削減、長期セッションで大きなコスト差

### v1 ドキュメントの扱い

- 初期検討版は破棄、本 v2 を正式設計とする
- 実装は v2 を一次ソースとする
- v1 の「Phase N」表記が出てきたら v2 の「Layer N / Wave N.M」に読み替え

---

## 11. 参考

- `docs/design/bg-fetch.md` — bg_fetch ツールの設計（要約対象の主例）
- `docs/design/agent-loop-detail.md` — エージェントループ本体
- `docs/design/system-prompt.md` — system prompt 分割構造
- 調査ノート（インライン）:
  - Claude Code: auto-compact + 完全版保持 + CLAUDE.md 階層 （Prompt Caching も利用しているが v2 では不採用）
  - 別の Web AI 拡張: トリム無し + artifact 逃がし + NavigationMessage
