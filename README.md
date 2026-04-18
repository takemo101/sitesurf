# SiteSurf 🌐

AIと一緒にWebページを操作するChrome拡張機能。

[Claude in Chrome](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) に影響を受けて開発しています。

## 機能

- **📄 ページ読取** - 現在のページのテキスト・DOM構造をAIに送信
- **🔧 DOM操作** - AIがJavaScriptでページ要素を操作（ネイティブ入力イベント / `isTrusted: true`）
- **🧭 ナビゲーション** - AIが指定URLへ移動、訪問URLは自動追跡してsystem promptに反映
- **🌐 バックグラウンドフェッチ** - `bg_fetch` ツール / REPL `bgFetch()` ヘルパでCORS制限を回避し外部URLを取得（Readability本文抽出対応、設定で ON）
- **🧪 REPL実行環境** - sandbox内で `browserjs / navigate / native* / artifact関数` を組み合わせたマルチステップ自動化
- **🎁 アーティファクト** - REPLが生成したJSON/HTML/CSV等をパネルに保存・配信
- **🎯 要素選択** - ページ上の要素をクリックして選択、AIに渡す
- **📸 スクリーンショット** - ページのスクリーンショットをAIに送信
- **💬 セッション管理** - 会話履歴をIndexedDBに自動保存・復元
- **🧠 自動コンテキスト圧縮** - 長い会話を構造化要約（Goal / Progress / Decisions）でローリング更新（クラウドはデフォルトON、ローカルは常時ON）
- **🛡️ プロンプトインジェクション検知** - ツール出力を毎回スキャンし、不審な指示文字列を AI に渡る前に要約に置き換え
- **🛠️ スキルシステム** - サイト別の抽出パターンを `markdown` で定義し、REPLから呼び出し
- **🔒 マルチウィンドウ対応** - セッションロックで競合を防止

## 対応AIプロバイダー

| プロバイダー                 | 認証方式            |
| ---------------------------- | ------------------- |
| **Anthropic** (Claude)       | APIキー             |
| **OpenAI** (ChatGPT)         | APIキー / OAuth     |
| **Google** (Gemini)          | APIキー             |
| **GitHub Copilot**           | OAuth (Device Flow) |
| **Kimi** (Moonshot AI)       | APIキー             |
| **Ollama**                   | なし                |
| **ローカルLLM** (OpenAI互換) | APIキー (任意)      |

各プロバイダーでエンドポイントURLをカスタマイズ可能。[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 等の Proxy 経由でも利用できます。

## 技術スタック

- **React 19** + **Mantine v9** (UIコンポーネント)
- **Vercel AI SDK v6** (AI接続抽象化 / ストリーミング)
- **Zustand** (状態管理)
- **Lucide React** (アイコン)
- **Framer Motion** (アニメーション)
- **React Markdown** (AIレスポンス表示)
- **[vite-plus](https://github.com/voidzero-dev/vite-plus)** (ビルド / lint / format / テスト)
- **TypeScript 6**

## セットアップ

[vite-plus](https://github.com/voidzero-dev/vite-plus) を使用しています。

```bash
# vite-plus のインストール (未導入の場合)
curl -fsSL https://vite.plus | bash

# 依存インストール
vp install

# ビルド (プロダクション)
vp build

# 開発 (watchモード: ファイル変更で自動リビルド)
vp build --watch

# チェック (format + lint + 型チェック)
vp check

# テスト
vp test
```

> **Note:** Chrome拡張はdevサーバー (HMR) では動作しないため、`vp build --watch` でwatchビルドを使います。
> ソースを変更すると `dist/` が自動で更新され、Chrome側で拡張を「更新」ボタンを押すと反映されます。

## Chrome に読み込む

1. `chrome://extensions/` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダ選択
4. 開発中はソース変更後に拡張の「🔄」ボタンで更新

## 使い方

1. Chrome右上のSiteSurfアイコンをクリック（または `Cmd+Shift+E`）
2. ⚙️ 設定でAIプロバイダーとAPIキーを入力
3. テキストボックスにやりたいことを入力して送信

### ローカルLLMの設定

SiteSurfは2種類のローカルLLM接続をサポートしています：

| プロバイダー                 | 用途              | 特徴                     |
| ---------------------------- | ----------------- | ------------------------ |
| **Ollama**                   | Ollama使用時      | ツール呼び出し対応、推奨 |
| **ローカルLLM (OpenAI互換)** | vLLM、LM Studio等 | OpenAI互換API用          |

---

#### Ollama を使用する場合（推奨）

Chrome拡張からOllamaに接続するには、CORS設定が必要です。

**macOSの場合**（GUIアプリとして起動する場合）：

```bash
# ~/Library/LaunchAgents/com.ollama.env.plist を作成
cat > ~/Library/LaunchAgents/com.ollama.env.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ollama.env</string>
    <key>ProgramArguments</key>
    <array>
        <string>sh</string>
        <string>-c</string>
        <string>launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

# 読み込んで適用
launchctl load ~/Library/LaunchAgents/com.ollama.env.plist

# Ollamaを再起動（メニューバー → Quit Ollama → 再起動）
```

**ターミナルから起動する場合**（一時的な設定）：

```bash
OLLAMA_ORIGINS="chrome-extension://*" ollama serve
```

**モデルのダウンロード**：

```bash
ollama pull llama3.2
```

**SiteSurfでの設定**：

- プロバイダー: **「Ollama」** を選択
- エンドポイントURL: `http://localhost:11434`（デフォルト）
- APIキー: 空欄でOK

---

#### その他のローカルLLM (vLLM、LM Studio等)

OpenAI互換APIを提供するローカルLLMサーバー用。

**SiteSurfでの設定**：

- プロバイダー: **「ローカルLLM (OpenAI互換)」** を選択
- エンドポイントURL: サーバーのURL（例: `http://localhost:1234`）
- APIキー: 必要に応じて入力（vLLM、LM Studio等）

### 使用例

```
「このページのすべてのリンクを一覧にして」
「検索ボックスに"Chrome拡張"と入力して検索ボタンを押して」
「このページの価格情報を抽出して」
```

## アーキテクチャ

**Feature-Sliced + Ports & Adapters** のハイブリッド。

```
src/
├── ports/               # インターフェース定義 (依存なし)
│   ├── ai-provider.ts       # AIProvider / ProviderConfig / StreamEvent
│   ├── auth-provider.ts     # AuthProvider / DeviceCodeInfo
│   ├── browser-executor.ts  # BrowserExecutor / TabInfo / PageContent
│   ├── storage.ts           # StoragePort
│   ├── session-storage.ts   # SessionStoragePort
│   └── session-types.ts     # Session / SessionMeta / ChatMessage
│
├── adapters/            # Port の具体実装
│   ├── ai/                  # Vercel AI SDK アダプター
│   ├── auth/                # OpenAI OAuth / Copilot Device Flow
│   ├── chrome/              # chrome.* API ラッパー
│   └── storage/             # chrome.storage / IndexedDB / InMemory
│
├── features/            # UI + ビジネスロジック (ports にのみ依存)
│   ├── chat/                # チャットUI・ChatSlice
│   ├── settings/            # 設定UI・SettingsSlice・永続化
│   ├── sessions/            # セッション管理・SessionSlice
│   └── tools/               # AIツール定義 + 実行関数
│
├── orchestration/       # Feature 間の連携
│   ├── agent-loop.ts        # ストリーミング + ツール実行ループ
│   ├── context-compressor.ts
│   ├── navigation-converter.ts
│   └── retry.ts
│
├── shared/              # 全レイヤーから参照可能 (依存なし)
│   ├── errors.ts            # Result<T,E> / AppError 型
│   ├── constants.ts         # ProviderId / ColorScheme
│   ├── message-types.ts     # Background 通信プロトコル
│   ├── deps-context.tsx     # DI Context (AppDeps)
│   └── utils.ts
│
├── store/               # Zustand store (slice の合成のみ)
│   ├── index.ts             # create + re-export
│   └── types.ts             # AppStore 型定義
│
├── sidepanel/           # Chrome サイドパネル (エントリーポイント)
│   ├── main.tsx             # Adapter 生成 + DI 注入
│   ├── App.tsx              # レイアウト + 初期化
│   ├── Header.tsx
│   ├── TabBar.tsx
│   ├── ui-store.ts          # UISlice
│   └── initialize.ts        # 起動シーケンス
│
├── background/          # Service Worker (Chrome API)
│   ├── index.ts             # メッセージルーター
│   └── handlers/            # 個別ハンドラー
│
public/
├── manifest.json
└── icons/
```

### 依存ルール

- `features/*` → `ports/*`, `shared/*` のみ（adapters 禁止）
- `features/*` 間の直接依存は禁止
- `ports/*`, `shared/*` → 依存なし
- `background/*` → `shared/message-types.ts` のみ

→ 詳細: [docs/architecture/](docs/architecture/)

## ドキュメントマップ

設計と運用上の判断は `docs/` 配下に集約。実装前にまず関連ドキュメントを確認する。

### アーキテクチャ（方針レベル）

- [overview](docs/architecture/overview.md) — 全体構造とレイヤ関係
- [package-structure](docs/architecture/package-structure.md) — ディレクトリ配置と依存ルール
- [state-management](docs/architecture/state-management.md) — Zustand slice 構成と永続化（autoCompact / enableBgFetch / enableSecurityMiddleware を含む）
- [tools](docs/architecture/tools.md) — BrowserExecutor Port とツール実行
- [error-handling](docs/architecture/error-handling.md) — `Result<T,E>` と例外の使い分け

### 主要な詳細設計

- [system-prompt](docs/design/system-prompt.md) — system prompt と REPL description の SSOT 分離
- [agent-loop-detail](docs/design/agent-loop-detail.md) — ターン進行 / コンテキスト整形 / セキュリティミドルウェア
- [tool-result-context-v2](docs/design/tool-result-context-v2.md) §5.5 — 現行のコンテキスト管理（ContextBudget / 構造化要約 / autoCompact）
- [bg-fetch](docs/design/bg-fetch.md) — `bg_fetch` ツールと REPL `bgFetch()` の二経路
- [security-middleware-design](docs/design/security-middleware-design.md) — プロンプトインジェクション検知と監査ログ
- [skill-system](docs/design/skill-system.md) — サイト別抽出スキルの定義と注入

### 設計判断（ADR）

- [ADR-006](docs/decisions/006-context-management-llm-compaction.md) — Layer 3 (`get_tool_result`) を廃止し LLM 圧縮で一本化（PR #69 / #66）

その他の ADR と設計詳細の一覧は [docs/design/README.md](docs/design/README.md) を参照。

## ライセンス

MIT
