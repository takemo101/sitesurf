# 002: Chrome拡張の開発ワークフロー (2026-04-02)

## ステータス: 承認済み

## コンテキスト

Chrome拡張のサイドパネルは `chrome-extension://` プロトコルで動作するため、
Viteの開発サーバー (HMR, `http://localhost`) は使えない。
開発中のファイル変更をどのように反映するかの方針が必要。

## 決定

`vp build --watch` による watchビルドを採用する。

```bash
vp build --watch   # ファイル変更で自動リビルド → dist/
```

- ビルド後処理 (manifest.json コピー、HTMLパス修正) は Viteプラグイン (`chromeExtensionPlugin`) に統合
- `package.json` の `scripts` は最小限にし、`vp` コマンドを直接使う

## 代替案

| 方式                        | 不採用理由                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `vp dev` (HMR)              | サイドパネルは `chrome-extension://` プロトコル。`localhost` では chrome.\* API が使えない |
| `npm run build`             | vp コマンドを直接使う方針に合わない                                                        |
| 外部watchツール (nodemon等) | vite の `--watch` フラグで十分                                                             |

## 結果

- `vp build --watch` 一発で dist/ が更新される
- Chrome側で拡張の🔄ボタンを押して反映する手順は残る
- 将来: chrome拡張向けのHMRプラグイン (crxjs等) を検討する可能性あり
