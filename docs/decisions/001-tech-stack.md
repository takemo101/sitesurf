# 001: 技術スタック選定 (2026-04-02)

## ステータス: 承認済み

## コンテキスト

既存拡張 をベースに、Web操作に特化したシンプルなChrome拡張を構築する。
既存拡張 は独自UIフレームワーク (mini-lit)、独自AIライブラリ (pi-mono) に依存しており、
そのまま利用できない。独立した技術スタックを選定する必要がある。

## 決定

| カテゴリ       | 選定               | 代替案                 | 選定理由                                                            |
| -------------- | ------------------ | ---------------------- | ------------------------------------------------------------------- |
| ビルド         | vite-plus          | Vite, webpack          | Viteベースの統一ツールチェーン、`vp build --watch` でChrome拡張開発 |
| UI             | React + Mantine v9 | shadcn/ui, Radix       | コンポーネント充実、ダークテーマ、サイドパネルのサイズに適合        |
| 状態管理       | Zustand            | Redux, Jotai           | 軽量、ボイラープレート少、Chrome拡張のコンテキストに適合            |
| AI接続         | Vercel AI SDK      | 素のfetch, 公式SDK個別 | プロバイダー統一API、ストリーミング対応、ツール呼出し統合           |
| アイコン       | Lucide React       | Heroicons, React Icons | 軽量、tree-shakable、既存拡張でも使用                               |
| アニメーション | Framer Motion      | CSS Transition         | 宣言的API、AnimatePresence                                          |
| Markdown       | react-markdown     | marked, remark         | React統合、コンポーネントカスタマイズ                               |
| OAuth          | 自前実装           | ライブラリなし         | Chrome拡張特有のフロー (tab redirect, device code)                  |

## 結果

- ビルドステップが必要 (`vp build`) だが、型安全性とモジュール分割のメリットが上回る
- Mantine v9 は API変更が多い (Collapse: `in` → `expanded`, Select: `creatable` 廃止等)
- Vercel AI SDK は `createOpenAI` の `baseURL` + `headers` で Copilot / Ollama も統一可能
