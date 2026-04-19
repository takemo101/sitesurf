# ツール設計

## 設計方針

- top-level tool の定義は `src/features/tools/` に置く
- 実行時のブラウザ依存は `ports/browser-executor.ts` と各 Port に抽象化する
- AI に見せる tool surface は `ALL_TOOL_DEFS` / `getAgentToolDefs()` を唯一の正本にする
- REPL 内 helper の説明は `src/shared/repl-description-sections.ts` に集約する
- `bg_fetch` の使い分け説明は top-level tool description を SSOT にする

## 現在の tool 一覧

`src/features/tools/index.ts` (Issue #83 のトークン最適化で 13 → **6** に統合)

| Tool        | 主責務                                                                                              | UI 表示                                                               |
| ----------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `repl`      | 複数ステップの JS 実行。`readPage()` / `browserjs()` / `navigate()` / artifact / nativeInput helper | specialized                                                           |
| `navigate`  | タブ移動・タブ一覧・タブ切替                                                                        | generic                                                               |
| `inspect`   | action 分岐: `pick_element` / `screenshot` / `extract_image`                                        | specialized (extract_image のみ画像プレビュー、他は generic fallback) |
| `skill`     | スキル管理 + draft 管理 (action で分岐)                                                             | generic                                                               |
| `artifacts` | Artifact Panel 上のファイル操作                                                                     | specialized                                                           |
| `bg_fetch`  | background 経由の fetch / readability                                                               | specialized                                                           |

### 廃止済み tool

v0.1.4 時点に比べて以下を統合・廃止:

- `read_page` → repl の `readPage()` helper に格下げ (Issue #94)
- `pick_element` / `screenshot` / `extract_image` → `inspect` tool の action に統合 (Issue #93)
- `list_skill_drafts` / `create_skill_draft` / `update_skill_draft` / `delete_skill_draft` → `skill` tool の action に統合 (Issue #85)

## BrowserExecutor との責務境界

`BrowserExecutor` は「ツール名」ではなく「ブラウザ能力」を表す Port。

```ts
interface BrowserExecutor {
  getActiveTab(): Promise<TabInfo>;
  openTab(url: string): Promise<number>;
  navigateTo(tabId: number, url: string): Promise<Result<NavigationResult, BrowserError>>;
  captureScreenshot(): Promise<string>;
  readPageContent(tabId: number, maxDepth?: number): Promise<Result<PageContent, BrowserError>>;
  executeScript(tabId: number, code: string): Promise<Result<ScriptResult, ToolError>>;
  injectElementPicker(
    tabId: number,
    message?: string,
  ): Promise<Result<ElementInfo | null, BrowserError>>;
}
```

### tool → capability の対応

| Tool                        | BrowserExecutor / その他                                                          |
| --------------------------- | --------------------------------------------------------------------------------- |
| `repl`                      | `getActiveTab()` + `executeScript()` + provider 群 (`readPage`, `browserjs`, ...) |
| `navigate`                  | `openTab()` / `navigateTo()` / active tab 情報                                    |
| `inspect` (`pick_element`)  | `getActiveTab()` + `injectElementPicker()`                                        |
| `inspect` (`screenshot`)    | `captureScreenshot()`                                                             |
| `inspect` (`extract_image`) | `captureScreenshot()` + page-side image extraction                                |
| `skill`                     | `StoragePort` + `SkillRegistry`                                                   |
| `artifacts`                 | `ArtifactStoragePort`                                                             |
| `bg_fetch`                  | Background handler（BrowserExecutor 非依存）                                      |

## AI に公開する一覧

### `ALL_TOOL_DEFS`

常に全定義を保持する静的一覧。

### `getAgentToolDefs({ enableBgFetch })`

実際に AI に公開する一覧を生成する。

- `repl` description は `buildReplToolDef({ enableBgFetch })` で動的生成
- `enableBgFetch=false` のとき `bg_fetch` を一覧から除外
- 同時に REPL helper `bgFetch()` も description から除外

この **tool list と prompt 表示を一緒に切り替える** ことが整合性の要点。

## REPL description の SSOT

Issue #111 で prompt section 本体はすべて `src/shared/prompt-sections/` に集約。
`src/shared/repl-description-sections.ts` はそこから import する薄い組み立てヘルパー。

含むもの (REPL description に載るもの):

- `repl-available-functions.ts` — 毎ターン送信される signature 一覧
- `repl-common-patterns.ts` — **条件注入** (初回 AI ターン or 直前に repl エラーが出たターンのみ、Issue #89)
- `bg-fetch-helper.ts` — `enableBgFetch` 有効時のみ

含まないもの (system prompt 側へ移動済み、Issue #88):

- `Tool Philosophy` — `src/shared/prompt-sections/tool-philosophy.ts` → system prompt
- `Security Boundary` — 同上
- `Completion Principle` — 同上

## System prompt との役割分担

### system prompt 側

- Core Identity
- Tool Philosophy
- Security Boundary
- Completion Principle
- 条件付き Skills section (shownSkillIds 差分注入、Issue #91: 既出は 1 行、新規は full)
- 条件付き Visited URLs section

### REPL description 側

- Available Functions (毎ターン送信、sizable に圧縮済み #90)
- 条件注入の Common Patterns
- `bgFetch()` の埋め込み説明行の有無

この分割により、Tool Philosophy / Common Patterns / Available Functions を複数箇所に重複定義せず、prompt cache hit 率を最大化する。

## 各ツールの要点

### `repl`

- sandbox iframe 上でコードを評価
- helper provider 群を通じて機能を公開
- 1 回の REPL 呼び出しで複数ステップをまとめるための中心ツール
- `read_page` を廃止して `readPage()` helper に格下げ済み (Issue #94)

#### REPL helper

- `readPage()` — 現在ページの軽量テキスト抽出 (旧 `read_page` top-level tool の置き換え)
- `browserjs()`
- `navigate()`
- `saveArtifact()` / `getArtifact()` / `listArtifacts()` / `deleteArtifact()` (ADR-007 統一 API)
- 旧 `createOrUpdateArtifact()` / `returnFile()` は deprecation wrapper として残置 (#137 で削除予定)
- Native Input Functions
- `bgFetch()` (`enableBgFetch=true` の場合のみ)

### `inspect`

action パラメータで 3 つの操作を分岐する統合 tool (Issue #93):

- `action: "pick_element"` — ユーザーにページ上の要素をクリックしてもらう。戻り値は selector / tag / text / attribute。UI は generic fallback で message と結果 JSON を表示
- `action: "screenshot"` — 現在の可視領域を data URL で返す。context 管理では `[screenshot captured]` に置換されうる。UI は generic fallback で画像プレビュー
- `action: "extract_image"` — selector 必須
- `img`, `canvas`, `background-image`, `video` を対象に画像を返す
- 専用 renderer でプレビューとメタ情報を表示する

### `skill`

1 つの tool に action を統合している。

- `list`
- `get`
- `create`
- `update`
- `patch`
- `delete`
- `list_drafts`
- `create_draft`
- `update_draft`
- `delete_draft`

**重要:** 独立した `create_skill_draft` top-level tool は存在しない。

### `bg_fetch`

`bg_fetch` は background service worker 経由で外部 URL を取得する独立ツール。

- `urls: string[]` で複数 URL を並列取得
- `response_type: "readability"` で本文抽出
- static / server-rendered pages や JSON API に向く
- SPA / CSR には向かないので `navigate()` + `readPage()` / `browserjs()` を促す

#### SSOT の原則

`bg_fetch` の詳しい使い分けは **top-level `bg_fetch` tool description 1 箇所**に集約する。
REPL helper `bgFetch()` はその説明を参照するだけにする。

## スキル注入の設計

### prompt に載せるもの

`system-prompt-v2.ts` の Skills section は以下のみを載せる (Issue #92 で `extractor.code` 本体を除外済み)。

- skill 名
- description
- 利用可能 extractor の signature
- output schema
- `window.skillId.extractorId()` 呼び出し例

さらに Issue #91 で**差分注入**が導入されている。session 内で既に AI に見せた skill は 2 回目以降 `- name (id: xxx): description` の 1 行に縮退する。
`shownSkillIds: Set<string>` は `ChatSlice` が保持し、orchestration へは `AgentLoopParams.getShownSkillIds` / `onSkillsShown` callback で注入する。

### runtime に載せるもの

`formatSkillsForSandbox()` が sandbox 用 object を組み立てる。
ここには `extractor.code` を含める。

### なぜ分けるか

- prompt から実装コードを除いてトークン削減
- prompt から危険な `new Function(...)` の誘導を消す
- それでも runtime 側では site-specific extractor を実行できる

つまり **「prompt では metadata のみ」「sandbox では executable code を保持」** が現行仕様。

## ToolCallBlock の表示方針

`src/features/chat/ToolCallBlock.tsx`

### specialized renderer あり

- `repl`
- `inspect` — dispatching renderer (`action=extract_image` のみ画像プレビュー、他は generic fallback)
- `artifacts`
- `bg_fetch`

### generic fallback

- `navigate`
- `skill`

Issue #93 の tool 統合後、`inspect` の `pick_element` / `screenshot` 実行時は dispatching renderer が generic fallback 相当の表示 (args + result JSON) に落とす。
専用 renderer が必要なのは視覚表現や進行状況 UI が必要な tool に限る。

## 依存ルールの観点

- `features/tools/*` は `ports/*` と `shared/*` に依存してよい
- `features/tools/*` から `adapters/*` を直接 import しない
- `repl` helper 実装は provider 分割で閉じ、agent-loop に細かい条件分岐を増やさない
- skill の型・validation は feature 横断のため `shared/` に置く
- tool 実行のオーケストレーションは `orchestration/agent-loop.ts`、個別機能は `features/tools/*` に閉じる

## 関連ファイル

- `src/features/tools/index.ts`
- `src/features/tools/repl.ts`
- `src/features/tools/skill.ts`
- `src/features/tools/bg-fetch.ts`
- `src/shared/repl-description-sections.ts`
- `src/features/chat/ToolCallBlock.tsx`
- `src/features/chat/tool-renderers/index.ts`
- `src/features/ai/system-prompt-v2.ts`
- `src/features/ai/sections/repl-philosophy.ts`
