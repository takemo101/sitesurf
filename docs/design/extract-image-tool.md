# extract_image ツール設計書（実装準拠）

## 概要

`extract_image` は **selector 指定で要素から画像を抽出**するツール。
現在の実装は `screenshot/selector` の mode 切替ではなく、`selector` 必須。

## 現在の仕様（source of truth）

- 対応要素
  - `img`
  - `canvas`（CORS/tainted で失敗する場合あり）
  - `background-image` を持つ要素
  - `video`（現在フレーム抽出。失敗時はフォールバック）

- パラメータ

```ts
{
  selector: string;        // 必須
  maxWidth?: number;       // 省略時 800
}
```

- 戻り値

```ts
interface ExtractImageResult {
  image: {
    type: "image";
    source: {
      type: "base64";
      base64: string;
      media_type: "image/png" | "image/jpeg" | "image/webp";
    };
  };
  info: {
    selector: string;
    originalWidth: number;
    originalHeight: number;
    resizedWidth: number;
    resizedHeight: number;
  };
}
```

## video 抽出のフォールバック

video はクロスオリジン制約で `canvas.toDataURL()` が失敗しやすいため、段階的フォールバックを実装。

1. 直接抽出（`video -> canvas -> toDataURL`）
2. 失敗時: visible screenshot を取得し、video矩形をクロップ
3. さらに失敗時: 全画面 screenshot を返却

## 実装ファイル

- `src/features/tools/extract-image.ts`
- `src/adapters/chrome/chrome-browser-executor.ts`
- UI表示: `src/features/chat/ToolCallBlock.tsx`

## 補足

- iframe 内 video（特に cross-origin）は取得失敗しうる。
- その場合は UI 側でエラー詳細を表示する実装になっている。
