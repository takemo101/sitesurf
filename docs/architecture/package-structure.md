# パッケージ構成

## 設計方針

**Feature-Sliced で機能単位に縦割りし、外部依存は Ports & Adapters で抽象化する。
feature間の調整は orchestration/ が担い、feature同士の直接依存を禁止する。**

## ディレクトリ構造

```
src/
│
│  ── Ports (外部依存の抽象) ──────────────────────
│
├── ports/
│   ├── ai-provider.ts           # AIモデル呼び出しの抽象
│   ├── artifact-storage.ts      # アーティファクト永続化の抽象
│   ├── auth-provider.ts         # 認証フロー (OAuth等) の抽象
│   ├── browser-executor.ts      # ページ操作 + タブ操作の抽象
│   ├── runtime-provider.ts      # ランタイム情報の抽象
│   ├── session-storage.ts       # セッション永続化の抽象
│   ├── session-types.ts         # SessionRecord 等のセッション共通型
│   ├── storage.ts               # 設定永続化の抽象
│   └── tool-executor.ts         # ツール実行の抽象
│
│  ── Adapters (Portの具体実装) ──────────────────
│
├── adapters/
│   ├── ai/
│   │   ├── vercel-ai-adapter.ts    # AIProvider 実装 (Vercel AI SDK)
│   │   ├── openai-codex-adapter.ts # OpenAI Codex 向けアダプター
│   │   ├── converters.ts           # メッセージ形式変換
│   │   └── provider-factory.ts     # 設定→LanguageModel 生成
│   │
│   ├── auth/
│   │   ├── openai-auth.ts          # OpenAI PKCE フロー
│   │   ├── copilot-auth.ts         # GitHub Copilot Device Flow
│   │   └── noop-auth.ts            # APIキー方式/認証不要のnull実装
│   │
│   ├── chrome/
│   │   └── chrome-browser-executor.ts  # BrowserExecutor 実装 (chrome.tabs/scripting/userScripts を直接呼び出す)
│   │
│   └── storage/
│       ├── chrome-storage.ts           # StoragePort 実装 (chrome.storage.local)
│       ├── indexeddb-session-storage.ts # SessionStorage 実装 (IndexedDB)
│       ├── artifact-storage.ts         # ArtifactStorage 実装
│       └── in-memory-storage.ts        # StoragePort/SessionStorage のインメモリ実装 (テスト用)
│
│  ── Features (ユーザーから見える機能単位) ──────
│
├── features/
│   ├── chat/                       # [機能] チャット
│   │   ├── ChatArea.tsx            #   メッセージ一覧
│   │   ├── ChatBubble.tsx          #   個別メッセージ (Markdown)
│   │   ├── MessageBubble.tsx       #   メッセージバブル外枠
│   │   ├── ToolCallBlock.tsx       #   ツール呼出し結果表示
│   │   ├── InputArea.tsx           #   入力欄 + アクションボタン
│   │   ├── NavigationBubble.tsx    #   ナビゲーション結果表示
│   │   ├── StreamingIndicator.tsx  #   ストリーミング中インジケーター
│   │   ├── SystemMessage.tsx       #   システムメッセージ表示
│   │   ├── ElementCard.tsx         #   選択要素カード表示
│   │   ├── ErrorMessage.tsx        #   エラーメッセージ表示
│   │   ├── MarkdownContent.tsx     #   Markdownレンダリング
│   │   ├── WelcomeScreen.tsx       #   初期表示ウェルカム画面
│   │   ├── sample-prompts.ts       #   サンプルプロンプト一覧
│   │   ├── system-prompt.ts        #   システムプロンプト生成
│   │   ├── theme.ts                #   チャット用テーマ定数
│   │   ├── chat-store.ts           #   Zustand slice (ChatSlice)
│   │   └── types.ts                #   ChatMessage, ToolCallInfo 等
│   │
│   ├── sessions/                   # [機能] セッション管理
│   │   ├── SessionListModal.tsx    #   セッション一覧モーダル
│   │   ├── SessionTitle.tsx        #   セッションタイトル表示・編集
│   │   ├── SessionItem.tsx         #   一覧内の個別セッション行
│   │   ├── DeleteOldMenu.tsx       #   古いセッションの一括削除メニュー
│   │   ├── EmptyState.tsx          #   セッションなし時の空表示
│   │   ├── session-store.ts        #   Zustand slice (SessionSlice)
│   │   ├── session-slice.ts        #   SessionSlice の型・初期値定義
│   │   ├── auto-save.ts            #   変更検知による自動保存ロジック
│   │   ├── save-builder.ts         #   SessionRecord 構築ヘルパー
│   │   ├── format-relative-date.ts #   「3分前」等の相対日時フォーマット
│   │   └── types.ts                #   SessionState 等の型定義
│   │
│   ├── settings/                   # [機能] 設定・認証
│   │   ├── SettingsPanel.tsx       #   設定パネル
│   │   ├── ProviderSelect.tsx      #   プロバイダー選択
│   │   ├── OAuthSection.tsx        #   OAuth認証セクション
│   │   ├── DeviceCodeDisplay.tsx   #   Copilot Device Code表示
│   │   ├── SkillsEditor.tsx        #   スキルエディター UI
│   │   ├── provider-visibility.ts  #   プロバイダー表示制御ロジック
│   │   ├── settings-store.ts       #   Zustand slice (SettingsSlice)
│   │   ├── persistence.ts          #   StoragePort経由の永続化
│   │   ├── skills-editor-state.ts  #   スキルエディター状態管理
│   │   ├── skills-persistence.ts   #   スキル永続化
│   │   ├── skills-drafts-state.ts  #   スキルドラフト状態管理
│   │   ├── skills-drafts-persistence.ts # スキルドラフト永続化
│   │   ├── skill-registry-sync.ts  #   スキルレジストリ同期
│   │   └── types.ts                #   Settings型
│   │
│   ├── tools/                      # [機能] Web操作ツール定義
│   │   ├── index.ts                #   全ツールのファクトリ
│   │   ├── providers/              #   ツールプロバイダー
│   │   ├── handlers/               #   ツールハンドラ
│   │   ├── definitions/            #   ツール定義 (read_page, repl, navigate 等)
│   │   └── skills/                 #   スキル連携ツール
│   │
│   ├── ai/                         # [機能] AI プロンプト管理 + コンテキスト予算
│   │   ├── system-prompt-v2.ts     #   システムプロンプト v2 生成 (VisitedUrl section 含む)
│   │   ├── system-prompt.ts        #   旧 system-prompt (互換用)
│   │   ├── prompt-cache.ts         #   プロンプトキャッシュ管理
│   │   ├── context-budget.ts       #   トークン予算計算 (Wave 1)
│   │   ├── structured-summary-prompt.ts # 構造化要約プロンプト生成 (Wave 2)
│   │   ├── index.ts                #   公開API
│   │   └── sections/               #   プロンプトセクション定義
│   │       ├── core-identity.ts
│   │       ├── security-boundary.ts
│   │       └── completion-principle.ts
│   │
│   ├── artifacts/                  # [機能] アーティファクト表示
│   │   ├── ArtifactPanel.tsx       #   アーティファクトパネル
│   │   ├── ArtifactPreview.tsx     #   プレビュー表示
│   │   ├── CodeView.tsx            #   コードビュー
│   │   ├── ArtifactFileItem.tsx    #   ファイルアイテム表示
│   │   ├── artifact-slice.ts       #   Zustand slice (ArtifactSlice)
│   │   └── types.ts                #   Artifact 型定義
│   │
│   └── security/                   # [機能] セキュリティ
│       ├── detection-engine.ts     #   脅威検出エンジン
│       ├── middleware.ts           #   セキュリティミドルウェア
│       ├── audit-logger.ts         #   監査ロガー
│       ├── patterns.ts             #   検出パターン定義
│       └── types.ts                #   Security 型定義
│
│  ── Orchestration (feature間の調整) ───────────
│
├── orchestration/
│   ├── agent-loop.ts              # streamText + ツール実行ループ
│   ├── context-compressor.ts      # トークン超過時のメッセージ圧縮
│   ├── context-manager.ts         # コンテキスト予算に基づく圧縮トリガー (Wave 2)
│   ├── navigation-converter.ts    # ナビゲーション結果の変換
│   ├── retry.ts                   # エラー時のリトライロジック
│   ├── security-audit.ts          # セキュリティ監査連携
│   ├── SecurityAuditSettingsSection.tsx # 監査ログ設定 UI
│   └── skill-detector.ts          # スキル検出ロジック
│
│  ── Store (slice合成 + 型定義) ──────────────────
│
├── store/
│   ├── index.ts                   # slice合成 + 永続化関数の組み立て
│   └── types.ts                   # AppStore 型 + TabInfo 型定義
│
│  ── エントリーポイント ─────────────────────────
│
├── sidepanel/                     # Side Panel (React mount + DI)
│   ├── index.html
│   ├── main.tsx                   #   Adapter生成 + DepsProvider
│   ├── App.tsx                    #   レイアウト + feature組み合わせ
│   ├── ErrorBoundary.tsx          #   エラーバウンダリ
│   ├── Header.tsx                 #   ヘッダー (セッション操作等)
│   ├── TabBar.tsx                 #   タブバー (Chat / Settings切り替え)
│   ├── initialize.ts              #   起動時の初期化処理 (設定読み込み等)
│   ├── ui-store.ts                #   UISlice (settingsOpen, activeTab 等)
│   ├── skill-registry-runtime.ts  #   スキルレジストリのランタイム管理
│   ├── hooks/
│   │   └── use-agent.ts           #   エージェント操作フック
│   └── styles.css
│
├── routes/                        # 遅延ロードされるルート/パネル (React.lazy)
│   └── index.ts                   #   ChatRoute, SettingsRoute, ArtifactsRoute
│
├── hooks/                         # sidepanel 横断の汎用 hook
│   └── use-progressive-loading.ts #   段階的 UI ロード制御
│
├── background/                    # Service Worker
│   ├── index.ts                   #   Port ベースのルーター (セッションロック + パネル追跡)
│   └── handlers/                  #   ハンドラ
│       ├── session-lock.ts        #   セッション排他ロック
│       ├── panel-tracker.ts       #   サイドパネルの開閉追跡
│       ├── native-input.ts        #   ネイティブ入力 (debugger API 経由)
│       └── bg-fetch.ts            #   bg_fetch 実行 (URLバリデーション + fetch + offscreen連携)
│
├── offscreen/                     # Offscreen Document (bg_fetch readability 用)
│   └── index.ts                   #   DOMParser + @mozilla/readability で本文抽出
│
│  ── 共通 ────────────────────────────────────────
│
└── shared/
    ├── deps-context.tsx           # 依存注入の React Context (DepsProvider / useDeps)
    ├── port.ts                    # Port (長接続) 通信モジュール (acquireLock, getLockedSessions)
    ├── message-types.ts           # Background⇔SidePanel メッセージ型 (参照用)
    ├── errors.ts                  # AppError, ToolError, AuthError
    ├── constants.ts               # ProviderId 等の定数・union型
    ├── skill-types.ts             # Skill 共通型
    ├── skill-parser.ts            # Skill Markdown パーサー
    ├── skill-markdown.ts          # Skill Markdown レンダリング
    ├── skill-draft-types.ts       # Skill ドラフト型定義
    ├── skill-draft-preview.ts     # Skill ドラフトプレビュー
    ├── skill-validation.ts        # Skill バリデーション
    ├── logger.ts                  # ロガー
    ├── models.generated.ts        # モデル定義 (自動生成)
    ├── token-constants.ts         # トークン関連定数
    ├── token-utils.ts             # トークン計算ユーティリティ
    ├── utils.ts                   # 汎用ユーティリティ関数
    └── hljs-theme.css             # highlight.js テーマ

src/artifact-popup/
└── main.tsx                       # アーティファクトポップアップのエントリー

public/
├── sandbox.html                   # repl ツール用 sandbox iframe (unsafe-eval 許可)
└── skills/                        # スキル定義 (Markdown)
```

## 依存ルール

### 許可される依存方向

```
sidepanel/      ──→  features/*, orchestration/, adapters/*, store/*, routes/, hooks/  (DI + 組み立て)
orchestration/  ──→  ports/*, shared/*,
                     features/chat (store), features/tools (定義),
                     features/ai (system-prompt, context-budget),
                     features/security (middleware)
features/*      ──→  ports/* (interfaceのみ), shared/*,
                     store/types (型のみ、AppStore 型参照に限定)
adapters/*      ──→  ports/* (interfaceを実装), shared/*
store/index     ──→  features/*/slice, sidepanel/ui-store (slice合成のみ)
store/types     ──→  features/*/types, sidepanel/ui-store (型のみ)
background/     ──→  shared/port, shared/message-types (型契約のみ)
offscreen/      ──→  shared/message-types (型契約のみ)
routes/, hooks/ ──→  features/*, shared/* (UI レイヤの一部)
全モジュール     ──→  shared/*
```

### 禁止される依存

```
features/*      ✗→  adapters/*         具体実装を知らない
features/*      ✗→  features/*         feature間の直接依存禁止
features/*      ✗→  store/index        slice合成結果への依存禁止 (循環防止)
ports/*         ✗→  (他の全て)          Portは誰にも依存しない
shared/*        ✗→  (他の全て)          共通モジュールは誰にも依存しない
background/     ✗→  features/*         実行コンテキストが異なる
background/     ✗→  adapters/*         backgroundはPort/Adapterの外
background/     ✗→  ports/*            backgroundはPort/Adapterの外
offscreen/      ✗→  features/*, adapters/*, ports/*  offscreenもPort/Adapterの外
adapters/chrome ✗→  shared/message-types  ツール実行はBackground経由ではなく直接Chrome API
orchestration/  ✗→  adapters/*         具体実装を知らない
store/types     ✗→  store/index        型定義ファイルは合成結果に依存しない
```

### 補足: store/ の役割分担

`store/` はアプリ全体の Zustand ストアを組み立てる薄いレイヤー。

- **`store/types.ts`**: `AppStore` 型と `TabInfo` 型を定義する。各 slice の型定義を import して合成するが、実装コードは含まない (型のみ)。
- **`store/index.ts`**: 各 feature の slice と `sidepanel/ui-store` の slice を `create()` で合成し、外部向けの `useStore` フックを export する。設定の永続化は `features/settings/persistence.ts` が担う。

各 feature の slice (`chat-store.ts`, `session-slice.ts` 等) は `AppStore` 型への参照が必要な場合に `store/types` を import できる。ただし `store/index` への依存は循環になるため禁止。

### 依存図

```
                    ┌────────────┐
                    │  shared/   │  (型・定数・エラー・DepsContext)
                    └─────▲──────┘
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
   ┌────┴─────┐    ┌──────┴───────┐    ┌─────┴───────┐
   │  ports/  │    │ features/*   │    │background/  │
   │(interface)│   │(chat,sessions│    │(SW + handlers)
   └────▲─────┘    │ settings,    │    └─────────────┘
        │          │ tools, ai,   │
        │          │ artifacts,   │
        │          │ security)    │
        │          └──────▲───────┘
        │                 │ uses
        │          ┌──────┴───────┐
        │          │orchestration/│
        │          │(agent-loop,  │
        │          │ compressor,  │
        │          │ retry等)     │
        │          └──────┬───────┘
        │                 │ uses ports
        │    ┌────────────┘
        │    │
   ┌────┴────▼───────────────┐
   │      adapters/*          │
   │  (ai, auth, chrome,     │
   │   storage)               │
   └──────────▲───────────────┘
              │ creates & injects
   ┌──────────┴──────────────────────┐
   │    sidepanel/ + store/           │
   │ (main.tsx が Adapter を生成して  │
   │  DepsProvider 経由で注入、       │
   │  store/index で slice を合成)    │
   └──────────────────────────────────┘
```

## ファイル命名規約

| 種別                | 規約                | 例                       |
| ------------------- | ------------------- | ------------------------ |
| Reactコンポーネント | PascalCase.tsx      | `ChatArea.tsx`           |
| Port (interface)    | kebab-case.ts       | `ai-provider.ts`         |
| Adapter (実装)      | kebab-case.ts       | `vercel-ai-adapter.ts`   |
| Store slice         | kebab-case-store.ts | `chat-store.ts`          |
| ロジック            | kebab-case.ts       | `agent-loop.ts`          |
| feature内型定義     | types.ts            | `features/chat/types.ts` |
| エラー定義          | errors.ts           | `shared/errors.ts`       |
| テスト              | \*.test.ts(x)       | `agent-loop.test.ts`     |

## 関連ドキュメント

- [概要](./overview.md) - アーキテクチャパターンの選定理由
- [ツール設計](./tools.md) - features/tools/ の詳細
- [状態管理設計](./state-management.md) - sliceの配置、DI手法
- [エラーハンドリング](./error-handling.md) - shared/errors.ts
- [テスト戦略](./testing.md) - テスト時のAdapter差替え
- [ADR-003](../decisions/003-architecture-pattern.md) - アーキテクチャ選定の経緯
