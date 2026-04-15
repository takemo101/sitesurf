# 003: アーキテクチャパターン選定 (2026-04-02)

## ステータス: 承認済み

## コンテキスト

Chrome拡張 + AIエージェントという特性を持つプロジェクトで、
どのアーキテクチャパターンを採用するかを決定する必要がある。

### プロジェクトの特性

- Chrome拡張の実行コンテキスト (Side Panel / Background / Content) が物理制約
- AIプロバイダーが5種 (Anthropic, OpenAI, Google, Copilot, ローカルLLM) と多い
- ツールは段階的に追加される
- チーム規模は小さい（個人〜少人数）

## 検討した選択肢

### A. 実行コンテキスト駆動

- ✅ 最もシンプル
- ❌ sidepanelが肥大化する
- ❌ テスト時にChrome APIモックが広範に必要

### B. レイヤードアーキテクチャ

- ✅ 依存方向が明確
- ❌ 1機能変更が全層にまたがる
- ❌ 「ドメイン層」が薄く、レイヤ数に見合わない

### C. Feature-Sliced ← 採用ベース

- ✅ 変更が1feature内に収まりやすい
- ❌ feature間の依存管理が必要
- ❌ 外部依存の抽象化が不十分

### D. Ports & Adapters ← 抽象化手法として採用

- ✅ テスタビリティ最高
- ❌ Chrome拡張の規模に対して過剰になりうる

## 決定

**Feature-Sliced + Ports & Adapters + Orchestration層 のハイブリッド**

```
sidepanel/ (DI)  →  orchestration/ (調整)  →  features/ (機能)  →  ports/ (interface)  ←  adapters/ (実装)
```

### 各層の役割

| 層               | 担当                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `features/`      | ユーザーから見える機能 (chat, settings, tools)                       |
| `orchestration/` | feature間の調整。agent-loopがAI→ツール→チャットを仲介                |
| `ports/`         | 外部依存の抽象 (AI, Auth, Browser, Storage)                          |
| `adapters/`      | Portの具体実装 (Vercel SDK, OAuth, chrome.\*, chrome.storage)        |
| `sidepanel/`     | エントリーポイント。Adapterを生成しReact Contextで注入               |
| `background/`    | Service Worker。shared/message-typesの型契約でadapters/chrome/と通信 |

### feature間の依存ルール

- **feature同士の直接importは禁止**
- feature間の連携が必要な場合は `orchestration/` が仲介する
- 型の共有は `ports/` (Portの引数/戻り値型) または `shared/` (3つ以上から参照される型) を使う

### 過剰設計を避ける工夫

- Portは本当に差替え需要がある箇所のみ (AI, Auth, Browser, Storage の4つ)
- Result型は外部ライブラリを使わず、Union型 + ヘルパー関数で実現
- feature が小さいうちはファイルを細かく分けすぎない

## 結果

- featureを見ればプロダクトの機能構成がわかる
- AI プロバイダー追加はAdapter追加のみで対応
- テスト時はPort のモック実装を注入 (Chrome API / AI API不要)
- feature間の依存が orchestration/ に集約され、循環が発生しない
- Background はPort/Adapterの枠外にあり、メッセージ型契約で疎結合
