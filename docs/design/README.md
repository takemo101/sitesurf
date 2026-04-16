# 設計ドキュメント一覧と状態

## architecture/ (方針レベル)

| ドキュメント                                                 | 状態 | 内容                                          |
| ------------------------------------------------------------ | ---- | --------------------------------------------- |
| [overview.md](../architecture/overview.md)                   | ✅   | 全体構造、レイヤ関係、技術スタック            |
| [ai-connection.md](../architecture/ai-connection.md)         | ✅   | プロバイダー抽象化、OAuth方針、ストリーミング |
| [tools.md](../architecture/tools.md)                         | ✅   | BrowserExecutor Port、ツール実行フロー        |
| [state-management.md](../architecture/state-management.md)   | ✅   | slice構造、永続化、セッション管理             |
| [package-structure.md](../architecture/package-structure.md) | ✅   | ディレクトリ構成、依存ルール                  |
| [error-handling.md](../architecture/error-handling.md)       | ✅   | エラー型定義、Result型、伝搬ルール            |
| [testing.md](../architecture/testing.md)                     | ✅   | テストレベル、モック設計                      |

## design/ (詳細設計)

### 機能・UI

| ドキュメント                                                   | 状態 | 内容                                                                |
| -------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| [ui-ux-design.md](./ui-ux-design.md)                           | ✅   | コンポーネントツリー、テーマ切替、レイアウト                        |
| [ui-components-detail.md](./ui-components-detail.md)           | ✅   | 全コンポーネントJSX、状態管理、エラー/ローディング/空状態、トースト |
| [tool-ui-refinement-design.md](./tool-ui-refinement-design.md) | ✅   | ツール実行結果の表示改善設計                                        |
| [artifact-panel-detail.md](./artifact-panel-detail.md)         | ✅   | アーティファクトパネル、ファイルプレビュー、サンドボックス          |
| [sandbox-implementation.md](./sandbox-implementation.md)       | ✅   | HTMLサンドボックス、postMessage通信                                 |
| [tab-management.md](./tab-management.md)                       | ✅   | タブ一覧・切替・新規作成ツール                                      |

### システムプロンプト

| ドキュメント                           | 状態 | 内容                                                     |
| -------------------------------------- | ---- | -------------------------------------------------------- |
| [system-prompt.md](./system-prompt.md) | ✅   | モジュラーセクション設計、トークン予算、セキュリティ境界 |

### スキルシステム

| ドキュメント                         | 状態 | 内容                                                              |
| ------------------------------------ | ---- | ----------------------------------------------------------------- |
| [skill-system.md](./skill-system.md) | ✅   | スキルAPI・Markdown形式・バリデーション・レジストリ・エディタ統合 |

### AI接続・認証

| ドキュメント                                               | 状態 | 内容                                    |
| ---------------------------------------------------------- | ---- | --------------------------------------- |
| [ai-provider-detail.md](./ai-provider-detail.md)           | ✅   | Port型定義、Adapter、converter、factory |
| [token-management-detail.md](./token-management-detail.md) | ✅   | AuthProvider、OAuth実装、ライフサイクル |
| [openai-oauth-detail.md](./openai-oauth-detail.md)         | ✅   | OpenAI OAuth (Codex) 対応の詳細設計     |

### コンテンツ抽出・ブラウザ操作

| ドキュメント                                                       | 状態 | 内容                                             |
| ------------------------------------------------------------------ | ---- | ------------------------------------------------ |
| [smart-content-extraction-v2.md](./smart-content-extraction-v2.md) | ✅   | read_page軽量抽出 + repl精密抽出の2段階設計      |
| [extract-image-tool.md](./extract-image-tool.md)                   | ✅   | 画像抽出ツール、セレクタ必須、maxWidthオプション |
| [native-input-events.md](./native-input-events.md)                 | ✅   | 12種のネイティブ入力関数、debugger API           |
| [bg-fetch.md](./bg-fetch.md)                                       | ✅   | bg_fetchツール、CORS回避、Readability本文抽出    |
| [wire-mode.md](./wire-mode.md)                                     | ✅   | WebSocketブリッジ、外部AIエージェント連携        |
| [abort-signal-support.md](./abort-signal-support.md)               | ✅   | REPL中止、chrome.userScripts.terminate()         |

### データ・状態

| ドキュメント                                                   | 状態 | 内容                                      |
| -------------------------------------------------------------- | ---- | ----------------------------------------- |
| [session-management-detail.md](./session-management-detail.md) | ✅   | IndexedDB、メタデータ分離、ロック、圧縮   |
| [data-flow.md](./data-flow.md)                                 | ✅   | ユーザー入力→AI→ツール→DOM→結果の全フロー |
| [indexeddb-migration.md](./indexeddb-migration.md)             | ✅   | スキーマバージョン管理、lazy migration    |

### セキュリティ

| ドキュメント                                                     | 状態 | 内容                                       |
| ---------------------------------------------------------------- | ---- | ------------------------------------------ |
| [security-middleware-design.md](./security-middleware-design.md) | ✅   | 検出エンジン、監査ログ、パターンマッチング |

### オーケストレーション・インフラ

| ドキュメント                                                               | 状態 | 内容                                                             |
| -------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| [agent-loop-detail.md](./agent-loop-detail.md)                             | ✅   | メインループ、ツール実行、キャンセル                             |
| [di-wiring.md](./di-wiring.md)                                             | ✅   | DepsContext、Composition Root、生成タイミング                    |
| [browser-executor-detail.md](./browser-executor-detail.md)                 | ✅   | Chrome Adapter、Backgroundルーター、ハンドラ                     |
| [boot-sequence.md](./boot-sequence.md)                                     | ✅   | 起動シーケンス、初期化フロー、フォールバック                     |
| [manifest-permissions.md](./manifest-permissions.md)                       | ✅   | パーミッション設計、manifest.json                                |
| [supplementary.md](./supplementary.md)                                     | ✅   | モデル切替、ヘルパー関数配置、定数定義、Chrome拡張ライフサイクル |
| [implementation-patterns.md](./implementation-patterns.md)                 | ✅   | Zustand slice統合、AI SDK Adapter接続、要素ピッカー注入コード    |
| [retry-rate-limit.md](./retry-rate-limit.md)                               | ✅   | リトライ戦略、指数バックオフ、エラー分類                         |
| [error-logging.md](./error-logging.md)                                     | ✅   | ロギング設計、DevTools連携、追跡イベント                         |
| [multi-window.md](./multi-window.md)                                       | ✅   | マルチウィンドウの状態分類、競合制御                             |
| [performance-optimization-design.md](./performance-optimization-design.md) | ✅   | プロンプトキャッシュ、コード分割、パフォーマンス最適化           |

## decisions/ (ADR)

| ドキュメント                                                                              | 状態   | 内容                              |
| ----------------------------------------------------------------------------------------- | ------ | --------------------------------- |
| [001-tech-stack.md](../decisions/001-tech-stack.md)                                       | 承認済 | 技術スタック選定                  |
| [002-chrome-extension-dev-workflow.md](../decisions/002-chrome-extension-dev-workflow.md) | 承認済 | 開発ワークフロー                  |
| [003-architecture-pattern.md](../decisions/003-architecture-pattern.md)                   | 承認済 | Feature-Sliced + Ports & Adapters |
| [004-browserjs-script-execution.md](../decisions/004-browserjs-script-execution.md)       | 承認済 | IIFE パターンによるスクリプト実行 |

## 状態の凡例

- ✅ 実装済み・現行
- 📝 参考資料（後継ドキュメントあり）
