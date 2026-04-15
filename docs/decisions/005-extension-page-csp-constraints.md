# 005: Extension Page の CSP 制約とコード検証

## 問題

`isExtractorFunctionSource()` が `new Function()` を使ってコードの構文検証を行っていたが、
Chrome 拡張の extension pages（サイドパネル、ポップアップ等）では **CSP (`script-src 'self'`)
により `new Function()` と `eval()` がブロックされる**。

結果として `isExtractorFunctionSource()` は常に `false` を返し、以下の連鎖障害が発生した:

1. `normalizeLegacyExtractorCode()` が正しい `function () {}` コードを二重ラップ
2. `collectDraftContractErrors()` がすべてのコードを reject
3. **create_skill_draft ツールでスキルが作成不可能**に

## CSP が効くコンテキストと効かないコンテキスト

| コンテキスト                                 | CSP                                        | `new Function()` | `eval()`     |
| -------------------------------------------- | ------------------------------------------ | ---------------- | ------------ |
| Extension pages (サイドパネル, ポップアップ) | `script-src 'self'`                        | **使用不可**     | **使用不可** |
| Background service worker                    | `script-src 'self'`                        | **使用不可**     | **使用不可** |
| Sandbox pages (`sandbox.html`)               | `sandbox allow-scripts; ... 'unsafe-eval'` | 使用可           | 使用可       |
| Content scripts (MAIN world)                 | ページの CSP に従う                        | サイトによる     | サイトによる |
| Content scripts (ISOLATED world)             | 拡張の CSP                                 | **使用不可**     | **使用不可** |

### ポイント

- `sandbox.html` は manifest で `sandbox` 指定されているため `unsafe-eval` が許可される。
  REPL のコード評価はここで行う設計になっている。
- **shared/ に置かれたユーティリティは extension page からも background からも呼ばれるため、
  `new Function()` / `eval()` を使ってはならない。**
- テスト環境 (vitest / Node.js) では CSP が存在しないため、
  `new Function()` を使ったコードはテストでは通るが実行時に壊れる。

## 対処方針

### やってはいけないこと

- `shared/` や `features/` のコードで `new Function()` や `eval()` をコード検証に使う
- テストが通ることを以って動作確認とする（CSP 制約はテストでは再現しない）

### 代替手段

| 用途                 | 代替方法                                                                       |
| -------------------- | ------------------------------------------------------------------------------ |
| 構文の妥当性チェック | 正規表現 + 括弧バランス（`sanitizeForValidation` で文字列/コメント除去後）     |
| コードの動的評価     | sandbox iframe 経由で実行（`postMessage` で通信）                              |
| パターンマッチ       | `sanitizeForValidation()` で文字列リテラル・コメントを除去してからパターン検査 |

## 実行パスごとの結果ラッピング

`chrome-browser-executor.ts` の `executeViaScripting` と `executeViaUserScripts` は
どちらも結果を `{ ok: boolean; value?: unknown; error?: string }` でラップし、
`normalizeScriptResponse()` に渡す。

**両方の実行パスで同じラッパー形式を使うこと。** 片方だけ生の結果を返すと、
ユーザーコードが `{ ok: true }` を返した場合に内部ラッパーと誤認される。

## テストでの注意

- `isExtractorFunctionSource` のテストでは副作用テスト
  （`globalThis` への書き込みがないこと）を含めて CSP 安全性を間接的に検証する
- `new Function()` が使われていないことを grep で定期的に確認する:
  ```bash
  grep -rn 'new Function' src/shared/ src/features/ --include='*.ts' | grep -v test | grep -v node_modules
  ```

## 関連ファイル

- `src/shared/skill-validation.ts` - `isExtractorFunctionSource()`, `sanitizeForValidation()`
- `src/adapters/chrome/chrome-browser-executor.ts` - `executeViaUserScripts()`, `executeViaScripting()`
- `public/manifest.json` - CSP 定義
- `public/sandbox.html` - `unsafe-eval` が許可される唯一のコンテキスト
