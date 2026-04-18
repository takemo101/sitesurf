# SiteSurf アーキテクチャ概要

## プロダクトの目的

AI と協調して Web ページを操作する Chrome 拡張機能。
ユーザーはレンダリング結果を見て、AI は DOM / ページ状態 / ツール結果を見ながら、ナビゲーション・抽出・自動化・成果物生成を行う。

## 採用アーキテクチャ

**Feature-Sliced + Ports & Adapters** のハイブリッド。

- `features/` はユーザーから見える機能単位で縦に切る
- 外部依存（AI / Chrome API / Storage）は `ports/` で抽象化し、`adapters/` に閉じ込める
- feature 間の調停は `orchestration/` が担当する
- `shared/` は誰にも依存しない共通型・純粋ユーティリティのみを置く

## 依存ルール

以下は**目標アーキテクチャ**。Issue #95 時点では一部に既知の逸脱があり、後述の「既知の例外」で管理する。

### 許可

- `sidepanel/` → `features/*`, `orchestration/*`, `adapters/*`, `store/*`
- `orchestration/` → `ports/*`, `shared/*`, 一部 `features/*`
- `features/*` → `ports/*`, `shared/*`, `store/types`
- `adapters/*` → `ports/*`, `shared/*`
- `background/` / `offscreen/` → `shared/message-types.ts` など型契約のみ

### 禁止

- `features/*` → `adapters/*`
- `features/*` → 他の `features/*`（原則）
- `shared/*` → `features/*`, `adapters/*`, `orchestration/*`
- `orchestration/*` → `adapters/*`

## 実行コンテキスト

Chrome 拡張は実行コンテキストが分離されるため、物理境界をそのまま設計に反映している。

```text
Side Panel (React UI)
  - AI 呼び出し
  - Zustand state
  - BrowserExecutor 経由のページ操作

Background Service Worker
  - セッションロック
  - panel tracking
  - native input
  - bg_fetch

Offscreen Document
  - bg_fetch readability 抽出

Page Context / Injected Script
  - browserjs() の実行対象
  - Skill extractor の実行対象
```

## ディレクトリの責務

```text
src/
├── features/
│   ├── chat/         UI 上の会話・ToolCall 表示
│   ├── sessions/     セッション一覧・保存
│   ├── settings/     認証・モデル・スキル設定
│   ├── tools/        top-level tool 定義と REPL helper 実装
│   ├── ai/           system prompt / prompt cache / context budget
│   ├── artifacts/    Artifact Panel と preview
│   └── security/     tool 出力の検査と監査ログ
├── orchestration/    agent-loop (callback 駆動) / tool pipeline / messages builder / URL tracker / context 管理
├── ports/            AI・Storage・BrowserExecutor などの抽象
├── adapters/         Vercel AI SDK / Chrome API / storage 実装
├── background/       service worker
├── offscreen/        readability 抽出
├── sidepanel/        React mount + DI
├── store/            Zustand slice 合成
└── shared/           共通型・純粋 utility・prompt section SSOT
```

## AI prompt / tool surface の整理

Issue #88-#92 以降、AI に見せる情報は次のように分離している。

### 1. System prompt (`src/features/ai/system-prompt-v2.ts`)

毎ターン送る基底 prompt。固定セクション文字列は `src/shared/prompt-sections/` に集約されている。

- `CORE_IDENTITY`
- `TOOL_PHILOSOPHY` (旧 `REPL_PHILOSOPHY` から rename)
- `SECURITY_BOUNDARY`
- `COMPLETION_PRINCIPLE`
- 条件付き `Skills` section (差分注入: 既出は short 1 行、新規は full)
- 条件付き `Visited URLs` section

`BASE_PROMPT` は 4 セクションを joined した module-level 定数のため、prompt cache に依存しない。

### 2. REPL description (`src/shared/prompt-sections/`)

REPL tool description の正本も `shared/prompt-sections/` に集約済み:

- `repl-available-functions.ts` — 毎ターン送信される signature 一覧 (~58 行)
- `repl-common-patterns.ts` — **条件注入** (初回 AI ターン or 直前の repl エラー時のみ、116 行)
- `bg-fetch-helper.ts` — `enableBgFetch` 有効時のみ注入 (24 行)

`src/shared/repl-description-sections.ts` は上記を呼び出す薄い組み立てヘルパー (~40 行)。

**重要:** Tool Philosophy / Common Patterns / Available Functions の SSOT は `src/shared/prompt-sections/`。
REPL description と system prompt の双方がここから import する。

### 3. Tool definitions (`src/features/tools/index.ts`)

`ALL_TOOL_DEFS` は top-level tool の唯一の一覧。Issue #83 のトークン最適化で大幅統合済み。

現在の定義 (6 個):

- `repl` — JS REPL (`readPage()`, `browserjs()`, `navigate()` 等の helper を含む)
- `navigate` — URL 遷移
- `inspect` — action 分岐 (`pick_element` / `screenshot` / `extract_image`)
- `skill` — action 分岐 (`list` / `get` / `create` / `update` / `patch` / `delete` / `list_drafts` / `create_draft` / `update_draft` / `delete_draft`)
- `artifacts` — ファイル作成・更新
- `bg_fetch` — background 経由の fetch (CORS 回避)

**廃止済み** (v0.1.4 時点と比較):
- `read_page` → repl の `readPage()` helper へ格下げ (#94)
- `pick_element` / `screenshot` / `extract_image` → `inspect` に統合 (#93)
- `list_skill_drafts` / `create_skill_draft` / `update_skill_draft` / `delete_skill_draft` → `skill` の action に統合 (#85)

エージェントに実際に公開する一覧は `getAgentToolDefs({ enableBgFetch })` で作る。
`enableBgFetch=false` のとき `bg_fetch` と REPL helper `bgFetch()` の両方を AI から隠す。

## スキル注入の設計

スキルは 2 つの面を持つ。

1. **system prompt にはメタデータだけを載せる**
   - skill 名
   - description
   - 利用可能 extractor の signature / output schema
   - `window.skillId.extractorId()` で呼べること
2. **実行コードは sandbox にだけ渡す**
   - `formatSkillsForSandbox()` が `extractor.code` を含む runtime object を作る
   - `executeRepl()` が sandbox へ渡す
   - `browserjs(() => window.youtube.getVideoInfo())` のように呼ぶ

つまり **`extractor.code` は prompt には出さず、runtime にのみ存在する**。

## UI 表示

ツール実行結果の UI は `features/chat/ToolCallBlock.tsx` を入口にし、
`features/chat/tool-renderers/` で specialized renderer を登録する。

- specialized: `repl`, `inspect` (action 分岐で extract_image は画像プレビュー、pick_element/screenshot は generic fallback)、`artifacts`, `bg_fetch`
- generic fallback: `navigate`, `skill`

Markdown レンダリングは `src/shared/ui/MarkdownContent.tsx` (旧 `features/chat/` から移動、#109)。

## 依存ルール違反の解消 (Issue #95 後)

以下の違反は Epic #83 の一環で解消済み:

- `src/orchestration/agent-loop.ts` の `features/chat/services/console-log` 依存 → `@/shared/console-log-types` に型を移動 (#108)
- `src/features/artifacts/ArtifactPreview.tsx` の `features/chat/MarkdownContent` 依存 → `@/shared/ui/MarkdownContent` に移動 (#109)
- `src/features/tools/__tests__/skill.test.ts` の `features/settings/*` 依存 → `@/shared/test-fixtures/skills` に fixture 移動 (#109)
- `src/orchestration/agent-loop.ts` の `useStore.getState()` 直叩き (artifact / session summary / shownSkillIds) → `AgentLoopParams` の callback (`artifactAutoExpand` / `onSessionSummaryUpdate` / `getShownSkillIds` / `onSkillsShown`) に置換 (#110)

## テスタビリティ

この構造により以下を維持する。

- feature 単位でテスト可能
- BrowserExecutor / Storage / AIProvider をモックに差し替え可能
- prompt 生成は pure function として検証可能
- UI renderer は server-side render でも検証可能

## 関連ドキュメント

- [パッケージ構成](./package-structure.md)
- [ツール設計](./tools.md)
- [AI接続設計](./ai-connection.md)
- [状態管理設計](./state-management.md)
- [テスト戦略](./testing.md)
- [システムプロンプト設計](../design/system-prompt.md)
