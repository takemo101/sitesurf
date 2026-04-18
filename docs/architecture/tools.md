# ツール設計

## 設計方針

- top-level tool の定義は `src/features/tools/` に置く
- 実行時のブラウザ依存は `ports/browser-executor.ts` と各 Port に抽象化する
- AI に見せる tool surface は `ALL_TOOL_DEFS` / `getAgentToolDefs()` を唯一の正本にする
- REPL 内 helper の説明は `src/shared/repl-description-sections.ts` に集約する
- `bg_fetch` の使い分け説明は top-level tool description を SSOT にする

## 現在の tool 一覧

`src/features/tools/index.ts`

| Tool            | 主責務                                                       | UI 表示     |
| --------------- | ------------------------------------------------------------ | ----------- |
| `read_page`     | 現在ページの軽量テキスト抽出                                 | generic     |
| `repl`          | 複数ステップの JS 実行、browserjs / navigate / artifact 操作 | specialized |
| `navigate`      | タブ移動・タブ一覧・タブ切替                                 | generic     |
| `pick_element`  | ユーザーに要素をクリック選択してもらう                       | generic     |
| `screenshot`    | 現在の可視領域スクリーンショット                             | generic     |
| `extract_image` | selector 指定で画像要素を抽出                                | specialized |
| `skill`         | スキル管理 + draft 管理                                      | generic     |
| `artifacts`     | Artifact Panel 上のファイル操作                              | specialized |
| `bg_fetch`      | background 経由の fetch / readability                        | specialized |

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

| Tool            | BrowserExecutor / その他                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| `read_page`     | `getActiveTab()` + `readPageContent()`                                              |
| `repl`          | `getActiveTab()` + `executeScript()` + provider 群                                  |
| `navigate`      | `openTab()` / `navigateTo()` / active tab 情報                                      |
| `pick_element`  | `getActiveTab()` + `injectElementPicker()`                                          |
| `screenshot`    | `captureScreenshot()`                                                               |
| `extract_image` | `captureScreenshot()` + page-side image extraction (`shared/extract-image-core.ts`) |
| `skill`         | `StoragePort` + `SkillRegistry`                                                     |
| `artifacts`     | `ArtifactStoragePort`                                                               |
| `bg_fetch`      | Background handler（BrowserExecutor 非依存）                                        |

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

REPL の説明文は `src/shared/repl-description-sections.ts` に集約されている。

含むもの:

- `AVAILABLE_FUNCTIONS`
- optional `COMMON_PATTERNS`
- `bgFetch()` に関する table / 説明行（独立 section ではなく埋め込み）

含まないもの:

- `Tool Philosophy`
- `Security Boundary`
- `Completion Principle`

それらは system prompt 側 (`features/ai/sections/*`) が担当する。

## System prompt との役割分担

### system prompt 側

- Core Identity
- Tool Philosophy
- Security Boundary
- Completion Principle
- 条件付き Skills section
- 条件付き Visited URLs section

### REPL description 側

- Available Functions
- optional Common Patterns
- `bgFetch()` の埋め込み説明行の有無

この分割により、Issue #88/89 の移設後も同じ概念が二重定義されない。

## 各ツールの要点

### `read_page`

- 目的: **軽量なページ概要取得**
- 複数ページ収集や繰り返し extraction の主戦場は `repl`
- description には 1 行の REPL 誘導だけを残し、詳細ワークフローは REPL description に寄せる

### `repl`

- sandbox iframe 上でコードを評価
- helper provider 群を通じて機能を公開
- 1 回の REPL 呼び出しで複数ステップをまとめるための中心ツール

#### REPL helper

- `browserjs()`
- `navigate()`
- `createOrUpdateArtifact()` / `getArtifact()` / `listArtifacts()` / `deleteArtifact()`
- `returnFile()`
- Native Input Functions
- `bgFetch()` (`enableBgFetch=true` の場合のみ)

### `pick_element`

- selector が不明なときに、ユーザーにページ上の要素をクリックしてもらう
- 戻り値は selector / tag / text / attribute など
- UI は generic fallback で message と結果 JSON を表示する

### `screenshot`

- 現在の可視領域を data URL で返す
- context 管理では長文の代わりに `[screenshot captured]` に置換されることがある
- UI は generic fallback で画像プレビューを表示する

### `extract_image`

- selector 必須
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
- SPA / CSR には向かないので `navigate()` + `read_page` / `browserjs()` を促す

#### SSOT の原則

`bg_fetch` の詳しい使い分けは **top-level `bg_fetch` tool description 1 箇所**に集約する。
REPL helper `bgFetch()` はその説明を参照するだけにする。

## スキル注入の設計

### prompt に載せるもの

`system-prompt-v2.ts` の Skills section は以下のみを載せる。

- skill 名
- description
- 利用可能 extractor の signature
- output schema
- `window.skillId.extractorId()` 呼び出し例

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
- `extract_image`
- `artifacts`
- `bg_fetch`

### generic fallback

- `read_page`
- `navigate`
- `pick_element`
- `screenshot`
- `skill`

Issue #93 系の UI 整理後も、`pick_element` / `screenshot` は generic fallback のままで問題ない。
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
