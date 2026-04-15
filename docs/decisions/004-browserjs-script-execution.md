# 004: browserjs スクリプト実行の正しいコード生成パターン

## 問題

`browserjs()` 関数を使用したスクリプト実行で「スクリプト結果なし」エラーが発生していた。

## 原因

`browser-js-provider.ts` で生成されるスクリプトコードの形式が、既存拡張 の `extract-image.ts` で使用されている正しいパターンと異なっていた。

### 誤ったパターン（結果が取得できない）

```typescript
const scriptCode = `return (${code})(${serializedArgs})`;
```

### 正しいパターン（既存拡張 準拠）

```typescript
const scriptCode = `(async () => {
  const fn = ${code};
  return await fn(${serializedArgs});
})()`;
```

## なぜ正しいパターンが必要か

1. **`chrome.userScripts.execute` の仕様**: コードをそのまま文字列として渡す際、最後の式の評価結果が返されるわけではない
2. **IIFE（Immediately Invoked Function Expression）**: 関数を定義して即座に実行することで、確実に Promise の結果を返す
3. **async/await の扱い**: `userScripts.execute` は async 関数の結果を正しく serialize して返すが、適切なラッパーが必要

## 一貫性のルール

**`chrome.userScripts.execute` を使用するすべての箇所で、以下のコード生成パターンを使用すること:**

```typescript
const serializedArgs = (args || []).map((a) => JSON.stringify(a)).join(", ");
const scriptCode = `(async () => {
  const fn = ${code};
  return await fn(${serializedArgs});
})()`;
```

このパターンは以下で使用されている:

- `src/features/tools/extract-image.ts`
- `src/features/tools/providers/browser-js-provider.ts`

## executeViaUserScripts の結果ラッピング

`chrome-browser-executor.ts` には 2 つの実行パスがある:

1. **`executeViaUserScripts`** — `chrome.userScripts.execute` を使用（優先）
2. **`executeViaScripting`** — `chrome.scripting.executeScript` を使用（フォールバック）

**両方のパスで結果を `{ ok: true, value: result }` / `{ ok: false, error: message }` でラップすること。**

`normalizeScriptResponse()` はこのラッパー形式を前提に動作する。
ユーザーコードが `{ ok: true, ... }` を返した場合、ラップなしだと内部プロトコルと誤認され、
`obj.value` (= undefined) が取り出されてオブジェクト戻り値が消失する。

詳細は [005-extension-page-csp-constraints.md](./005-extension-page-csp-constraints.md) を参照。

## 関連ファイル

- `src/adapters/chrome/chrome-browser-executor.ts` - 実行エンジン
- `src/features/tools/providers/browser-js-provider.ts` - browserjs() 実装
- `src/features/tools/extract-image.ts` - 画像抽出（正しい実装例）

## 教訓

コード生成パターンを変更する際は、**必ず既存の動作している実装（extract-image.ts）と比較し、同じパターンを使用すること**。

既存拡張 のコードベースを参考にする際も、同じパターンが使われていることを確認すること。
