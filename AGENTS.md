# SiteSurf AI ガイドライン

## プロジェクト概要

AIと協調してWebページを操作するChrome拡張機能。
React + Mantine + Vercel AI SDK + Zustand + vite-plus で構成。

## 基本原則

- 日本語でやりとりすること
- シンプルさの優先: 変更を可能な限りシンプルに保つ
- 影響の最小化: 必要な箇所のみを変更し、バグの混入を防ぐ

## アーキテクチャ

**Feature-Sliced + Ports & Adapters** のハイブリッド。

- `features/` は Port に依存し、Adapter には依存しない
- `features/` 間の直接依存は禁止。`orchestration/` が仲介する
- `ports/` と `shared/` は誰にも依存しない
- `background/` は Port/Adapter の枠外。`shared/message-types.ts` の型契約のみ

→ 詳細: [docs/architecture/overview.md](docs/architecture/overview.md)

## 設計ドキュメント

実装前に必ず該当する設計ドキュメントを確認すること。

### アーキテクチャ (方針)

| ドキュメント                                                                     | 参照タイミング               |
| -------------------------------------------------------------------------------- | ---------------------------- |
| [docs/architecture/overview.md](docs/architecture/overview.md)                   | 全体構造を把握する時         |
| [docs/architecture/package-structure.md](docs/architecture/package-structure.md) | ファイルの配置場所を決める時 |
| [docs/architecture/error-handling.md](docs/architecture/error-handling.md)       | エラー処理を書く時           |
| [docs/architecture/state-management.md](docs/architecture/state-management.md)   | Zustand store を変更する時   |
| [docs/architecture/tools.md](docs/architecture/tools.md)                         | ツールを追加・変更する時     |
| [docs/architecture/testing.md](docs/architecture/testing.md)                     | テストを書く時               |

### 詳細設計

| ドキュメント                                                                         | 参照タイミング                     |
| ------------------------------------------------------------------------------------ | ---------------------------------- |
| [docs/design/feature-spec.md](docs/design/feature-spec.md)                           | 機能の振る舞いを確認する時         |
| [docs/design/ui-ux-design.md](docs/design/ui-ux-design.md)                           | UIのレイアウト・テーマを確認する時 |
| [docs/design/ui-components-detail.md](docs/design/ui-components-detail.md)           | コンポーネントのJSXを実装する時    |
| [docs/design/agent-loop-detail.md](docs/design/agent-loop-detail.md)                 | agent-loop を実装する時            |
| [docs/design/ai-provider-detail.md](docs/design/ai-provider-detail.md)               | AI接続を実装する時                 |
| [docs/design/token-management-detail.md](docs/design/token-management-detail.md)     | OAuth を実装する時                 |
| [docs/design/session-management-detail.md](docs/design/session-management-detail.md) | セッション永続化を実装する時       |
| [docs/design/browser-executor-detail.md](docs/design/browser-executor-detail.md)     | Background通信を実装する時         |
| [docs/design/boot-sequence.md](docs/design/boot-sequence.md)                         | 起動処理を実装する時               |
| [docs/design/di-wiring.md](docs/design/di-wiring.md)                                 | DI / Adapter 注入を実装する時      |
| [docs/design/supplementary.md](docs/design/supplementary.md)                         | ヘルパー関数・定数を実装する時     |
| [docs/design/README.md](docs/design/README.md)                                       | 全設計ドキュメントの一覧と状態     |

## ライブラリリファレンス

実装時にAPIの使い方を確認するために参照すること。
`docs/references/` 配下に公式ドキュメントをクロール・整理したものを配置。

| ライブラリ           | リファレンス                                             | 主な用途                             |
| -------------------- | -------------------------------------------------------- | ------------------------------------ |
| **Vercel AI SDK v6** | [docs/references/ai-sdk/](docs/references/ai-sdk/)       | streamText, ツール定義, プロバイダー |
| **Mantine v9**       | [docs/references/mantine/](docs/references/mantine/)     | UIコンポーネント, テーマ             |
| **vite-plus**        | [docs/references/vite-plus/](docs/references/vite-plus/) | ビルド設定                           |
| **Zustand**          | [docs/references/zustand/](docs/references/zustand/)     | 状態管理                             |

### リファレンスの使い方

- 各ライブラリの README.md にドキュメント構成と主要トピックの一覧がある
- **AI SDK v6**: `ai-sdk/core/core.md` が streamText / TextStreamPart / ToolSet 等の中心。`ai-sdk/reference/reference.md` に全 API 型定義
- **Mantine v9 の注意**: v8 以前と API が異なる箇所が多い。必ず [v9.0.0 changelog](docs/references/mantine/changelog/version-v900.md) を確認

## コーディング規約

### ファイル命名

| 種別                      | 規約                | 例                       |
| ------------------------- | ------------------- | ------------------------ |
| Reactコンポーネント       | PascalCase.tsx      | `ChatArea.tsx`           |
| ロジック / Port / Adapter | kebab-case.ts       | `agent-loop.ts`          |
| Store slice               | kebab-case-store.ts | `chat-store.ts`          |
| feature内型定義           | types.ts            | `features/chat/types.ts` |
| テスト                    | \*.test.ts(x)       | `agent-loop.test.ts`     |

### Zustand

```typescript
// ✅ 個別セレクター
const messages = useStore((s) => s.messages);

// ✅ getState() でstale closure回避
const toggle = () => {
  const { settingsOpen, setSettingsOpen } = useStore.getState();
  setSettingsOpen(!settingsOpen);
};

// ❌ destructuring (不要な再レンダリング)
const { messages, isStreaming } = useStore();
```

### Mantine テーマ

```tsx
// ❌ ハードコード
<Paper bg="dark.7">

// ✅ テーマ追従
<Paper bg="var(--mantine-color-body)">
<Paper withBorder>
<Text c="dimmed">
```

### エラーハンドリング

- 回復可能なエラー: `Result<T, E>` 型で返す
- 回復不能なエラー (バグ): 例外で投げる
- → 詳細: [docs/architecture/error-handling.md](docs/architecture/error-handling.md)

### Linter / Formatter

vite-plus 統合の Oxlint + Oxfmt を使用。

```bash
vp check          # format + lint + 型チェック
vp check --fix    # 自動修正
vp fmt --write    # フォーマット適用
vp lint --fix     # lint 修正
```

→ 詳細: [docs/design/build-config.md](docs/design/build-config.md)

## 修正・変更時の記録ルール

### AGENTS.md

- 現在有効な制約・注意点のみ記載 (肥大化させない)
- 詳細は `docs/decisions/` にADRとして記録

### docs/decisions/

- 技術選定の経緯、設計判断の理由を記録
- 既存:
  - [001-tech-stack](docs/decisions/001-tech-stack.md)
  - [002-dev-workflow](docs/decisions/002-chrome-extension-dev-workflow.md)
  - [003-architecture](docs/decisions/003-architecture-pattern.md)
  - [004-browserjs-script-execution](docs/decisions/004-browserjs-script-execution.md)
  - [005-extension-page-csp-constraints](docs/decisions/005-extension-page-csp-constraints.md)
  - [006-context-management-llm-compaction](docs/decisions/006-context-management-llm-compaction.md)
  - [007-artifact-storage-unification](docs/decisions/007-artifact-storage-unification.md)（提案中）

## 既知の制約

- Mantine v9: `Collapse` は `expanded` prop (`in` ではない)。`Select` に `creatable` なし → [v9 変更点](docs/references/mantine/changelog/version-v900.md)
- Chrome拡張: サイドパネルでは `vp dev` (HMR) は使えない → `vp build --watch` を使用 → [ADR-002](docs/decisions/002-chrome-extension-dev-workflow.md)
- Anthropic API: ブラウザから直接呼ぶには `anthropic-dangerous-direct-browser-access` ヘッダーが必要
- Extension Pages の CSP: サイドパネル等では `new Function()` / `eval()` は使えない → [ADR-005](docs/decisions/005-extension-page-csp-constraints.md)

## 主要な機能トグルとデフォルト

| 設定                       | デフォルト | 効果                                                                                |
| -------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `autoCompact`              | `true`     | クラウドでも構造化要約による自動コンテキスト圧縮を行う（ローカル/Ollama は常時 ON） |
| `enableBgFetch`            | `false`    | `bg_fetch` ツールと REPL `bgFetch()` ヘルパを有効化（OFF 時は AI から完全に隠す）   |
| `enableSecurityMiddleware` | `true`     | ツール出力をプロンプトインジェクション検知にかけ、検出時は AI に安全な要約を返す    |

新機能を追加する際は、これらのトグルとの相互作用（特に `enableBgFetch=false` 時の prompt / tool list 一貫性）を必ず確認すること。詳細は [ADR-006](docs/decisions/006-context-management-llm-compaction.md) と [bg-fetch.md](docs/design/bg-fetch.md)。

## システムプロンプトと REPL description の SSOT

PR #79 以降、Tool Philosophy / Common Patterns / Available Functions は **`src/shared/repl-description-sections.ts` のみが正本**。`src/features/ai/sections/` には CORE_IDENTITY / SECURITY_BOUNDARY / COMPLETION_PRINCIPLE のみ。AI が REPL から呼べる関数を追加・変更する場合は repl-description-sections.ts を編集し、system prompt 側に同じ内容を書かないこと → [system-prompt.md](docs/design/system-prompt.md)

## モデル一覧の更新

モデル一覧は `https://models.dev/api.json` から自動生成される。

```bash
npm run generate-models
```

これで `src/shared/models.generated.ts` が更新される。`src/shared/constants.ts` はこのファイルを参照してモデルリストを構築する。

### 手動確認が必要な場合の参照先

| プロバイダー  | 公式モデル一覧ページ                                                    | 備考                                                                                         |
| ------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Anthropic** | https://docs.anthropic.com/en/docs/about-claude/models                  | alias 形式 (`claude-sonnet-4-6` 等) を使う。snapshot 日付は不要                              |
| **OpenAI**    | https://platform.openai.com/docs/models                                 | model ID はそのまま (`gpt-5.4` 等)                                                           |
| **Google**    | https://ai.google.dev/gemini-api/docs/models/gemini                     | `gemini-2.5-flash` 等。preview 版は安定するまで含めない                                      |
| **Copilot**   | https://docs.github.com/en/copilot/reference/ai-models/model-comparison | Gemini は `-preview` サフィックスが必要。`gpt-5.4` 等は `/chat/completions` 非対応の場合あり |

### 注意事項

- Copilot は OpenAI 互換の `/chat/completions` API を使う。Responses API 専用モデル (`gpt-5.4` 等) は使えない場合がある
- Copilot の Claude モデル ID は Anthropic 直接とは異なる (`claude-sonnet-4.6` vs `claude-sonnet-4-6`)
- Copilot の Gemini モデルは `-preview` サフィックスが必要 (`gemini-3-flash-preview`)
