# TandemWeb アーキテクチャ概要

## プロダクトの目的

AIと協調してWebページを操作するChrome拡張機能。
ユーザーが閲覧中のページをAIが読み取り、DOM操作・ナビゲーション・データ抽出を行う。

## 採用アーキテクチャ: Feature-Sliced + Ports & Adapters

**機能単位の縦割り (Feature-Sliced)** で構成しつつ、
各featureの外部依存は **Ports & Adapters** パターンで抽象化する。

### なぜこの組み合わせか

| 課題                    | Feature-Sliced が解決                      | Ports & Adapters が解決               |
| ----------------------- | ------------------------------------------ | ------------------------------------- |
| 変更がどこで閉じるか    | 機能ごとの縦割りで変更が1feature内に収まる | -                                     |
| AI プロバイダーの差替え | -                                          | Port (interface) を通じた差替え可能性 |
| テスト容易性            | feature単位でのテスト                      | Adapterのモック差替え                 |
| Chrome API への依存     | -                                          | chrome.\* をAdapterに閉じ込める       |

### 原則

1. **各featureは自己完結的**: UI + ロジック + 状態を内包する
2. **外部依存はPortを通じてアクセス**: AI API、Chrome API、Storage に直接依存しない
3. **Adapterは差替え可能**: テスト時にモック、将来の技術変更に対応
4. **feature間の依存は一方向**: 依存グラフは非循環。オーケストレーションはアプリケーション層が担う

## 設計の基本原則

- **シンプルさの優先**: Chrome拡張としての規模感に見合った抽象化。過剰な層分割はしない
- **関心の分離**: Chrome拡張の実行コンテキスト制約に沿い、物理境界を尊重する
- **プロバイダー非依存**: AI接続をPortで抽象化し、プロバイダー追加が既存featureに影響しない
- **テスタビリティ**: Adapter差替えにより、Chrome API やAI APIなしでロジックをテスト可能

## 実行コンテキストの制約

Chrome拡張 (Manifest V3) には3つの隔離された実行コンテキストがある。
これはアーキテクチャの「物理制約」であり、選択ではない。

```
┌──────────────────────────────────────────────────────────┐
│  Side Panel (React UI)                                    │
│  ・ユーザーとの対話、AI API呼び出し、状態管理              │
│  ・chrome.tabs / chrome.scripting / chrome.userScripts   │
│    を直接呼び出す (Background 経由不要)                    │
├──────────────────────────────────────────────────────────┤
│  Background Service Worker                                │
│  ・セッションロック (Port 長接続) のみ                     │
│  ・サイドパネルの開閉追跡                                  │
│  ※ DOM不可、UI不可、ライフサイクル短い(idle時停止)          │
├──────────────────────────────────────────────────────────┤
│  Content Script / Injected Script                         │
│  ・対象ページのDOMに直接アクセス                            │
│  ※ chrome.* API制限あり、ページごとに隔離                  │
└──────────────────────────────────────────────────────────┘

通信:
  Side Panel ──→ chrome.scripting.executeScript ──→ ページ (直接)
  Side Panel ←─ chrome.runtime.Port (長接続) ──→ Background
               (セッションロックのみ)
```

## 全体構造

```
src/
├── features/                    # 機能単位の縦割り (ユーザーから見える機能)
│   ├── chat/                    #   チャット機能 (UI + 状態)
│   ├── sessions/                #   セッション管理 (UI + 状態)
│   ├── settings/                #   設定・認証機能 (UI + 状態)
│   ├── tools/                   #   Web操作ツール定義
│   │   ├── providers/           #     ツールプロバイダー
│   │   ├── handlers/            #     ツールハンドラ
│   │   ├── definitions/         #     ツール定義
│   │   └── skills/              #     スキル連携
│   ├── ai/                      #   システムプロンプト v2 + プロンプトキャッシュ + sections/
│   ├── artifacts/               #   アーティファクトパネル・プレビュー・コードビュー
│   └── security/                #   検出エンジン・ミドルウェア・監査ロガー・パターン
│
├── orchestration/               # featureの組み合わせ・調整
│   ├── agent-loop.ts            #   streamText + ツール実行ループ
│   ├── security-audit.ts        #   セキュリティ監査連携
│   └── skill-detector.ts        #   スキル検出ロジック
│
├── ports/                       # 外部依存の抽象 (interface)
│   ├── ai-provider.ts           #   AI APIの抽象
│   ├── artifact-storage.ts      #   アーティファクト永続化の抽象
│   ├── auth-provider.ts         #   認証フローの抽象
│   ├── browser-executor.ts      #   ページ操作 + タブ操作の抽象
│   ├── runtime-provider.ts      #   ランタイム情報の抽象
│   ├── session-storage.ts       #   セッション永続化の抽象
│   ├── session-types.ts         #   セッション共通型
│   ├── storage.ts               #   永続化の抽象
│   └── tool-executor.ts         #   ツール実行の抽象
│
├── adapters/                    # Port の具体実装
│   ├── ai/                      #   Vercel AI SDK 実装 + OpenAI Codex アダプター
│   ├── auth/                    #   OAuth フロー実装
│   ├── chrome/                  #   chrome.tabs/scripting/userScripts を直接呼び出す BrowserExecutor 実装
│   └── storage/                 #   chrome.storage 実装 (ArtifactStorage を含む)
│
├── background/                  # Service Worker エントリー + ハンドラ
│   ├── index.ts                 #   Port ベースのセッションロック + パネルトラッキングのみ
│   └── handlers/                #   ハンドラ
│       ├── session-lock.ts      #     セッション排他ロック
│       ├── panel-tracker.ts     #     サイドパネル開閉追跡
│       └── native-input.ts      #     ネイティブ入力 (debugger API 経由)
│
├── sidepanel/                   # Side Panel エントリー (React mount + DI)
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx
│   ├── ErrorBoundary.tsx        #   エラーバウンダリ
│   ├── skill-registry-runtime.ts #  スキルレジストリのランタイム管理
│   └── hooks/
│       └── use-agent.ts         #   エージェント操作フック
│
├── shared/                      # feature横断の型・定数
│   ├── deps-context.tsx          #   依存注入の React Context (DepsProvider / useDeps)
│   ├── port.ts                  #   Port (長接続) 通信モジュール (acquireLock, getLockedSessions)
│   ├── message-types.ts         #   Background⇔SidePanel メッセージ型 (参照用)
│   ├── errors.ts                #   エラー型の分類
│   ├── constants.ts             #   定数
│   ├── skill-types.ts           #   Skill 共通型 (feature 間共有のため shared に配置)
│   ├── skill-parser.ts          #   Skill Markdown パーサー (複数 feature で使用)
│   ├── skill-markdown.ts        #   Skill Markdown レンダリング
│   ├── skill-draft-types.ts     #   Skill ドラフト型定義
│   ├── skill-draft-preview.ts   #   Skill ドラフトプレビュー
│   ├── skill-validation.ts      #   Skill バリデーション
│   ├── logger.ts                #   ロガー
│   ├── models.generated.ts      #   モデル定義 (自動生成)
│   ├── token-constants.ts       #   トークン関連定数
│   ├── token-utils.ts           #   トークン計算ユーティリティ
│   ├── utils.ts                 #   汎用ユーティリティ
│   └── hljs-theme.css           #   highlight.js テーマ
│
public/
├── sandbox.html                 # repl ツール用 sandbox iframe (unsafe-eval 許可)
└── skills/                      # スキル定義 (Markdown)
```

### レイヤ間の関係

```
┌────────────────────────────────────────────────────────┐
│  sidepanel/ (エントリー + DI)                           │
│  Adapter を生成し、orchestration と features に注入する  │
└────────┬──────────────────────────────────────────────-─┘
         │ injects adapters
         ▼
┌────────────────────────────────────────────────────────┐
│  orchestration/ (アプリケーション層)                     │
│  agent-loop が features を組み合わせてユースケースを実行  │
│  依存先: ports/, features/chat (store), features/tools  │
└────────┬──────────────────────────────────────────────-─┘
         │ uses
         ▼
┌────────────────────────────────────────────────────────┐
│  features/ (機能単位)                                   │
│  chat, sessions, settings, tools, ai, artifacts,       │
│  security: 各機能の UI + 状態 + ロジック                │
│  依存先: ports/ (interfaceのみ), shared/                │
└────────┬──────────────────────────────────────────────-─┘
         │ depends on (interface only)
         ▼
┌────────────────────────────────────────────────────────┐
│  ports/ (interface)   │  shared/ (型・定数・エラー)     │
│  誰にも依存しない      │  誰にも依存しない              │
└────────▲──────────────┘──────────────────────────────-─┘
         │ implements
┌────────┴──────────────────────────────────────────────-┐
│  adapters/ (具体実装)                                   │
│  ai/, auth/, chrome/ (直接Chrome API呼び出し), storage/ │
└────────────────────────────────────────────────────────┘

          ┌──────────────────────────────────────────────┐
          │  background/ (Service Worker)                 │
          │  shared/port.ts のみに依存                    │
          │  Side Panel と Port (長接続) で通信            │
          │  (セッションロック + パネル追跡のみ)            │
          └──────────────────────────────────────────────┘
```

**feature は Port に依存し、Adapter には依存しない。**
**feature 間の直接依存は禁止。orchestration/ が仲介する。**

## 技術スタック

| カテゴリ       | 技術               | 選定理由                                |
| -------------- | ------------------ | --------------------------------------- |
| ビルド         | vite-plus          | Viteベースの統一ツールチェーン          |
| UI             | React + Mantine v9 | コンポーネント充実、ダークテーマ対応    |
| 状態管理       | Zustand            | 軽量、Chrome拡張のコンテキストに適合    |
| AI接続         | Vercel AI SDK      | プロバイダー統一API、ストリーミング対応 |
| アイコン       | Lucide React       | 軽量、tree-shakable                     |
| アニメーション | Framer Motion      | 宣言的API                               |
| Markdown       | react-markdown     | AI応答の表示                            |
| 言語           | TypeScript         | 型安全性                                |

## 関連ドキュメント

- [AI接続設計](./ai-connection.md) - プロバイダー抽象化、OAuth、ストリーミング
- [ツール設計](./tools.md) - ツール定義、実行フロー、拡張方針
- [状態管理設計](./state-management.md) - Zustand store構造、永続化
- [パッケージ構成](./package-structure.md) - ディレクトリ構造と依存ルール
- [エラーハンドリング](./error-handling.md) - エラー分類と伝搬方針
- [テスト戦略](./testing.md) - テストレベルとモック戦略
- [ADR-003: アーキテクチャ選定](../decisions/003-architecture-pattern.md) - 選定の経緯
