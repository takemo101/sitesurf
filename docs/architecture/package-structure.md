# パッケージ構成

## 設計方針

**Feature-Sliced で機能単位に切り、外部依存は Ports & Adapters で抽象化する。**

- `features/` は原則として Port と `shared/` に依存する
- `features/` 同士の直接 import は原則禁止
- `orchestration/` が feature 間の調停を担う
- `shared/` は pure な共通部品だけを置く

> Issue #95 時点では一部に既知の例外がある。理想ルールと現状実装を混同しないこと。

## 主要ディレクトリ

```text
src/
├── ports/
│   ├── ai-provider.ts
│   ├── artifact-storage.ts
│   ├── auth-provider.ts
│   ├── browser-executor.ts
│   ├── runtime-provider.ts
│   ├── session-storage.ts
│   ├── session-types.ts
│   ├── storage.ts
│   └── tool-executor.ts
│
├── adapters/
│   ├── ai/
│   │   ├── converters.ts
│   │   ├── openai-codex-adapter.ts
│   │   ├── provider-factory.ts
│   │   └── vercel-ai-adapter.ts
│   ├── auth/
│   ├── chrome/
│   │   └── chrome-browser-executor.ts
│   └── storage/
│
├── features/
│   ├── chat/
│   │   ├── ChatArea.tsx
│   │   ├── ChatBubble.tsx
│   │   ├── ElementCard.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── InputArea.tsx
│   │   ├── MarkdownContent.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── NavigationBubble.tsx
│   │   ├── StreamingIndicator.tsx
│   │   ├── SystemMessage.tsx
│   │   ├── ToolCallBlock.tsx
│   │   ├── WelcomeScreen.tsx
│   │   ├── ArtifactToolMessage.tsx
│   │   ├── TokenUsageDisplay.tsx
│   │   ├── chat-store.ts
│   │   ├── sample-prompts.ts
│   │   ├── services/console-log.ts
│   │   ├── tool-renderers/
│   │   │   ├── bg-fetch-renderer.tsx
│   │   │   ├── components.tsx
│   │   │   ├── index.ts
│   │   │   ├── registry.ts
│   │   │   └── types.ts
│   │   └── __tests__/
│   │
│   ├── sessions/
│   ├── settings/
│   │   ├── SkillsEditor.tsx
│   │   ├── provider-visibility.ts
│   │   ├── settings-store.ts
│   │   ├── persistence.ts
│   │   ├── skills-editor-state.ts
│   │   ├── skills-persistence.ts
│   │   ├── skills-drafts-state.ts
│   │   ├── skills-drafts-persistence.ts
│   │   └── skill-registry-sync.ts
│   │
│   ├── tools/
│   │   ├── index.ts
│   │   ├── bg-fetch.ts
│   │   ├── extract-image.ts
│   │   ├── navigate.ts
│   │   ├── pick-element.ts
│   │   ├── read-page.ts
│   │   ├── repl.ts
│   │   ├── screenshot.ts
│   │   ├── skill.ts
│   │   ├── definitions/
│   │   │   └── artifacts-tool.ts
│   │   ├── handlers/
│   │   │   ├── artifacts-handler.ts
│   │   │   └── index.ts
│   │   ├── providers/
│   │   │   ├── artifact-provider.ts
│   │   │   ├── browser-js-provider.ts
│   │   │   ├── fetch-provider.ts
│   │   │   ├── index.ts
│   │   │   ├── native-input-provider.ts
│   │   │   └── navigate-provider.ts
│   │   └── skills/
│   │       ├── index.ts
│   │       ├── registry.ts
│   │       ├── skill-loader.ts
│   │       ├── skill-parser.ts
│   │       ├── types.ts
│   │       └── validator.ts
│   │
│   ├── ai/
│   │   ├── context-budget.ts
│   │   ├── index.ts
│   │   ├── prompt-cache.ts
│   │   ├── structured-summary-prompt.ts
│   │   ├── system-prompt-v2.ts
│   │   ├── sections/
│   │   │   ├── completion-principle.ts
│   │   │   ├── core-identity.ts
│   │   │   ├── index.ts
│   │   │   ├── repl-philosophy.ts
│   │   │   └── security-boundary.ts
│   │   └── __tests__/
│   │
│   ├── artifacts/
│   └── security/
│
├── orchestration/
│   ├── agent-loop.ts
│   ├── context-compressor.ts
│   ├── context-manager.ts
│   ├── navigation-converter.ts
│   ├── retry.ts
│   ├── security-audit.ts
│   ├── SecurityAuditSettingsSection.tsx
│   └── skill-detector.ts
│
├── store/
│   ├── index.ts
│   └── types.ts
│
├── sidepanel/
│   ├── App.tsx
│   ├── ErrorBoundary.tsx
│   ├── Header.tsx
│   ├── TabBar.tsx
│   ├── index.html
│   ├── initialize.ts
│   ├── main.tsx
│   ├── skill-registry-runtime.ts
│   ├── styles.css
│   ├── ui-store.ts
│   └── hooks/use-agent.ts
│
├── background/
│   ├── index.ts
│   └── handlers/
│       ├── bg-fetch.ts
│       ├── native-input.ts
│       ├── panel-tracker.ts
│       └── session-lock.ts
│
├── offscreen/
│   └── index.ts
│
└── shared/
    ├── artifact-types.ts
    ├── constants.ts
    ├── deps-context.tsx
    ├── errors.ts
    ├── extract-image-core.ts
    ├── logger.ts
    ├── markdown.css
    ├── message-types.ts
    ├── model-utils.ts
    ├── models.generated.ts
    ├── port.ts
    ├── repl-description-sections.ts
    ├── skill-draft-preview.ts
    ├── skill-draft-types.ts
    ├── skill-markdown.ts
    ├── skill-parser.ts
    ├── skill-registry.ts
    ├── skill-types.ts
    ├── skill-validation.ts
    ├── token-constants.ts
    ├── token-utils.ts
    ├── truncate-utils.ts
    └── utils.ts
```

## 現在の重要ポイント

### `features/ai/`

- legacy `system-prompt.ts` は存在しない
- system prompt 本体は `system-prompt-v2.ts`、`BASE_PROMPT` は module-level 定数
- **prompt section 本体はすべて `src/shared/prompt-sections/` に集約** (Issue #111)
  - `core-identity.ts`, `tool-philosophy.ts`, `security-boundary.ts`, `completion-principle.ts`
  - `repl-available-functions.ts`, `repl-common-patterns.ts`, `bg-fetch-helper.ts`
- `src/shared/repl-description-sections.ts` は上記を組み立てる薄い shim
- skill section は **差分注入** (`shownSkillIds` を参照し、既出は 1 行の short format、新規は full format、Issue #91)

### `features/tools/`

- top-level tool 一覧は `index.ts` の `ALL_TOOL_DEFS` (6 本)
  - `repl`, `navigate`, `inspect`, `skill`, `artifacts`, `bg_fetch`
- `inspect` は `action: "pick_element" | "screenshot" | "extract_image"` で分岐 (Issue #93)
- `skill` は draft 系 action も含む統合 tool (Issue #85)
- `read_page` は top-level tool として存在しない。repl の `readPage()` helper で呼ぶ (Issue #94)
- `definitions/` は現在 `artifacts-tool.ts` のみ

### `features/chat/`

Tool result UI は 2 段構え。

- `ToolCallBlock.tsx`: 共通コンテナ + generic fallback
- `tool-renderers/`: specialized renderer
- Markdown レンダリングは `src/shared/ui/MarkdownContent.tsx` を使う (Issue #109 で chat から移動)

specialized renderer があるのは次の tool のみ:

- `repl`
- `inspect` — dispatching renderer。`action=extract_image` は画像プレビュー、他は generic fallback
- `artifacts`
- `bg_fetch`

それ以外は generic fallback で表示する。

### `orchestration/`

agent-loop は Issue #110 で以下に分離:

- `agent-loop.ts` — streamText ループ (644行、`useStore.getState()` の直叩きなし)
- `tool-execution-pipeline.ts` — ツール実行 + callback 経由の副作用通知
- `messages-builder.ts` — AI API 用メッセージ組み立て
- `visited-url-tracker.ts` — tool 結果から URL 追跡 (純関数)

UI state (artifact panel / session snapshot / shownSkillIds) の更新は
`AgentLoopParams` の callback (`artifactAutoExpand` / `onSessionSummaryUpdate` /
`getShownSkillIds` / `onSkillsShown`) で注入する。

## 依存ルール

```text
sidepanel/      -> features/*, orchestration/*, adapters/*, store/*
orchestration/  -> ports/*, shared/*, features/* (必要最小)
features/*      -> ports/*, shared/*, store/types
adapters/*      -> ports/*, shared/*
store/index     -> features の slice を合成
background/     -> shared/* の型契約のみ
offscreen/      -> shared/* の型契約のみ
```

### 禁止

```text
features/*   X-> adapters/*
features/*   X-> features/*   (原則)
shared/*     X-> features/*, adapters/*, orchestration/*
orchestration/* X-> adapters/*
ports/*      X-> 他レイヤ
```

## 既知の例外

- `src/features/tools/index.ts` / `src/features/tools/providers/fetch-provider.ts` → `@/store/index`

過去に検出された以下の違反は Epic #83 で解消済み:

- ~~`src/features/artifacts/ArtifactPreview.tsx` → `@/features/chat/MarkdownContent`~~ → `@/shared/ui/MarkdownContent` (#109)
- ~~`src/orchestration/agent-loop.ts` → `@/features/chat/services/console-log`~~ → `@/shared/console-log-types` (#108)
- ~~`src/orchestration/agent-loop.ts` の `useStore.getState()` 直叩き~~ → callback 経由に変更 (#110)
- ~~`src/features/tools/__tests__/skill.test.ts` → `@/features/settings/*`~~ → `@/shared/test-fixtures/skills` (#109)

## `shared/` に置くものの基準

`shared/` に置くのは次のいずれかに限る。

- feature 横断で使う型
- pure function / pure constant
- framework や Chrome API に依存しない utility
- prompt SSOT のような「単独 feature に閉じない文字列定義」

逆に、次は `shared/` に置かない。

- Zustand state
- feature 固有 UI
- orchestration 用の分岐ロジック
- adapter 依存の処理

## 関連ドキュメント

- [概要](./overview.md)
- [ツール設計](./tools.md)
- [AI接続設計](./ai-connection.md)
