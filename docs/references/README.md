# ライブラリリファレンス

本プロジェクトで使用するライブラリのドキュメント。
各ライブラリの公式ドキュメントをクロールし、トピック別に整理したもの。

## ライブラリ一覧

### Vercel AI SDK v6 (`ai`, `@ai-sdk/*`)

AI プロバイダーの統一API、ストリーミング、ツール呼び出し。

- [ai-sdk/](./ai-sdk/) — 101ページ、8カテゴリ

実装時に特に参照するトピック:

- `ai-sdk/core/core.md` — streamText, generateText, ツール呼び出し, エラーハンドリング
- `ai-sdk/reference/reference.md` — API リファレンス、型定義
- `ai-sdk/providers/providers.md` — OpenAI, Anthropic, Google プロバイダー設定
- `ai-sdk/foundations/` — プロンプト構造, ストリーミング, ツール概念

### Mantine v9 (`@mantine/core`, `@mantine/hooks`, etc.)

React UIコンポーネントライブラリ。

- [mantine/](./mantine/) — 94ページ、10カテゴリ

実装時に特に参照するトピック:

- `mantine/core-components/` — UIコンポーネント詳細
- `mantine/theming/` — MantineProvider, テーマオブジェクト, カラー
- `mantine/styles/` — CSS Modules, CSS Variables, レスポンシブ
- `mantine/changelog/version-v900.md` — v9 の破壊的変更

### vite-plus (`vp`)

ビルドツールチェーン。

- [vite-plus/](./vite-plus/) — 8ページ

実装時に特に参照するトピック:

- `vite-plus/commands/development.md` — vp dev, check, lint, fmt, test
- `vite-plus/commands/build-and-pack.md` — vp build
- `vite-plus/config/overview.md` — vite.config.ts 設定

### Zustand

軽量状態管理。

- [zustand/](./zustand/) — 8ページ

実装時に特に参照するトピック:

- `zustand/getting-started/introduction.md` — 基本的な使い方
- `zustand/api/create-api.md` — create() API リファレンス
- `zustand/guides/persistence.md` — 永続化ミドルウェア
