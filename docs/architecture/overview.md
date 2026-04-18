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
├── orchestration/    agent-loop / context 管理 / retry / security audit
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

毎ターン送る基底 prompt。固定セクションは `src/features/ai/sections/` に分割されている。

- `CORE_IDENTITY`
- `REPL_PHILOSOPHY`
- `SECURITY_BOUNDARY`
- `COMPLETION_PRINCIPLE`
- 条件付き `Skills` section
- 条件付き `Visited URLs` section

### 2. REPL description SSOT (`src/shared/repl-description-sections.ts`)

REPL tool description の正本。

- `COMMON_PATTERNS`
- `AVAILABLE_FUNCTIONS`
- `bgFetch()` helper の表示/非表示 (`enableBgFetch`)

**重要:** Tool Philosophy / Common Patterns / Available Functions を複数箇所に重複定義しない。
REPL から呼べる関数やワークフロー文言は `src/shared/repl-description-sections.ts` を編集する。

### 3. Tool definitions (`src/features/tools/index.ts`)

`ALL_TOOL_DEFS` は top-level tool の唯一の一覧。

現在の定義:

- `read_page`
- `repl`
- `navigate`
- `pick_element`
- `screenshot`
- `extract_image`
- `skill`
- `artifacts`
- `bg_fetch`

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

- specialized: `repl`, `extract_image`, `artifacts`, `bg_fetch`
- generic fallback: `read_page`, `navigate`, `pick_element`, `screenshot`, `skill`

`pick_element` / `screenshot` は generic fallback で十分なため専用 renderer を持たない。

## 既知の例外（Issue #95 時点）

- `src/features/tools/index.ts` と `src/features/tools/providers/fetch-provider.ts` は `@/store/index` に依存しており、理想の `features/* -> store/types` ルールから外れている
- `src/features/artifacts/ArtifactPreview.tsx` は `@/features/chat/MarkdownContent` を import しており、feature 間依存の例外になっている

この issue では **違反を解消したのではなく、最終レビューで可視化した**。必要なら follow-up issue で解消する。

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
