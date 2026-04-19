# Artifact Panel 詳細設計

> **注記 (2026-04 以降)**: ADR-007 ([#131](https://github.com/takemo101/sitesurf/pull/131)) により Artifact ストレージは単一ストア構造に統合されました。本ドキュメントは統合後の現状を反映しています。旧 2 ストア構造 (JSON store + File store 分離) の設計は [ADR-007](../decisions/007-artifact-storage-unification.md) を参照。

## 概要

AI が `saveArtifact()` で保存したデータをユーザーが確認・プレビューできる UI パネル。**Flex side-by-side** パターンで、可視 artifact がある場合のみ右パネルを表示する。

## アーキテクチャ

```
features/artifacts/
  artifact-slice.ts      ← ArtifactSlice (Zustand)
  ArtifactPanel.tsx      ← 一覧 + プレビューの全体コンテナ
  ArtifactFileItem.tsx   ← 1 ファイル分の行コンポーネント (kind バッジ付き)
  ArtifactPreview.tsx    ← 種別ごとのプレビュー (HTML / Markdown / JSON / Image / Code / Default)
  CodeView.tsx           ← syntax highlighter
  types.ts               ← ArtifactEntry 型 (shared/artifact-types.ts を再エクスポート)
```

`features/artifacts/` は `ports/artifact-storage.ts` にのみ依存し、Adapter には依存しない (Feature-Sliced + Ports & Adapters)。

## データフロー

### 保存と UI 反映 (REPL 経由)

```
[AI] saveArtifact("page.html", "<h1>...</h1>") を REPL で呼ぶ
  ↓ sandbox.html が postMessage で sandbox-request を親 (side panel) に送る
ArtifactProvider.handleRequest → ArtifactStoragePort.put()
  ↓ IndexedDB (ARTIFACTS_STORE = "artifacts-v2") に書き込み
exec-result メッセージ受信 → REPL 完了
  ↓ orchestration/agent-loop.ts: artifactAutoExpand.onReplCompleted(prevNames)
use-agent.ts: loadArtifacts() → Zustand slice を storage から再同期
  ↓ 差分を検出 → 新規 artifact を selectArtifact()
  ↓ kind: "file" かつ preview 価値の高い拡張子 (html/markdown) なら setArtifactPanelOpen(true)
ArtifactPanel が再描画され、visible:true の項目のみ表示
```

### Top-level `artifacts` tool 経由

```
[AI] { name: "artifacts", command: "create", filename: "x.html", content: "..." }
  ↓
features/tools/handlers/artifacts-handler.ts: handleArtifactsTool()
  ↓ stringContentToArtifactValue で ArtifactValue に変換
ArtifactStoragePort.put()
  ↓ artifactSlice.setArtifacts() で即時 UI 反映
```

## Port 設計 (ADR-007 統一)

```ts
// src/ports/artifact-storage.ts
export type ArtifactKind = "json" | "file";

export interface ArtifactMeta {
  name: string;
  kind: ArtifactKind;
  mimeType?: string; // kind === "file" のみ
  size: number;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ArtifactValue =
  | { kind: "json"; data: unknown }
  | { kind: "file"; bytes: Uint8Array; mimeType: string };

export interface ArtifactStoragePort {
  put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void>;
  get(name: string): Promise<ArtifactValue | null>;
  list(): Promise<ArtifactMeta[]>;
  delete(name: string): Promise<void>;
  setSessionId(sessionId: string | null): void;
  clearAll(): Promise<void>;
}
```

Adapter: `src/adapters/storage/artifact-storage.ts` (`ChromeArtifactStorage`) が IndexedDB 単一 store `artifacts-v2` にキー `${sessionId}::${name}` で保存。

## ArtifactEntry (UI 側の表現)

```ts
// src/shared/artifact-types.ts
export type ArtifactType = "json" | "html" | "markdown" | "text" | "image" | "binary";

export interface ArtifactEntry {
  name: string;
  type: ArtifactType; // 拡張子から detectType() で導出
  source: "json" | "file"; // Port の ArtifactMeta.kind と対応
  updatedAt: number;
}
```

UI は `type` (拡張子由来、プレビューの振り分け) と `source` (kind、バッジ表示) の 2 軸を持つ。data 本体は保持せず、プレビュー時に `storage.get()` で都度取得する (大きいファイルでも安全)。

## ArtifactSlice (現行)

```ts
export interface ArtifactSlice {
  artifacts: ArtifactEntry[];
  selectedArtifact: string | null;
  loadArtifacts(): Promise<void>;
  setArtifactSessionId(sessionId: string | null): void;
  selectArtifact(name: string | null): void;
  removeArtifact(name: string): Promise<void>;
  clearArtifacts(): void;
  setArtifacts(artifacts: ArtifactEntry[]): void;
}
```

### loadArtifacts の挙動 (ADR-007 後)

1 回の `storage.list()` で統合された `ArtifactMeta[]` を取得
→ `visible: true` でフィルタ
→ `kind` から `source`、`detectType(name)` から `type` を導出して `ArtifactEntry[]` に変換

旧 v0.1.5 実装では `list()` + `listFiles()` の 2 経路をマージしていたが、ADR-007 で 1 経路に統一。

## レイアウト

### Panel なし (artifacts 0 件)

```
┌─── 400px ──────────────────────┐
│ Header                          │
├─────────────────────────────────┤
│ ChatArea (flex:1)               │
├─────────────────────────────────┤
│ InputArea                       │
└─────────────────────────────────┘
```

### Panel あり (`artifactPanelOpen && visible 件数 > 0`)

```
┌─── 400px ──────────────────────┐
│ Header                          │
├──────────────┬──────────────────┤
│ ChatArea     │ [📄] results.json JSON│
│ (flex:1,     │ [🌐] chart.html   FILE│
│  minWidth:0) │ [📝] memo.md      FILE│
│              ├──────────────────┤
│              │ [プレビュー領域] │
├──────────────┴──────────────────┤
│ InputArea                       │
└─────────────────────────────────┘
```

- `MainLayout` 内のラッパー `Group` で flex 制御 (ChatArea を Box で包み `flex: 1` を Box 側に)
- Panel の幅は固定、`artifacts.filter(a => a.visible).length > 0` の時だけ描画

## 主要コンポーネント

### ArtifactFileItem

- 左端: `TYPE_ICONS[artifact.type]` (json/html/markdown/text/image/binary で 6 種)
  - `title` 属性で `"JSON 値"` / `"ファイル"` の tooltip
- 中央: ファイル名 (truncate)
- 右端: **kind バッジ** (`source` の値 "json"/"file" を uppercase + letter-spacing で小さく表示)
- 最右: 削除ボタン (hover 時のみ表示)

### ArtifactPreview

`ArtifactPanel` が `artifactStorage.get(name)` で `ArtifactValue` を取り出し、kind / mimeType / bytes または data を `ArtifactPreview` に渡す。

分岐:

- `type === "html"` → `HtmlPreview` (extension `sandbox.html` iframe で実行)
- `type === "markdown"` → `MarkdownPreview` (react-markdown)
- `type === "image"` → `ImagePreview` (`kind: "file"` の bytes を data URL に変換)
- `type === "json"` → `DataPreview` (テーブル / 整形 / ソース タブ)
- その他の code 拡張子 → `CodePreview`
- それ以外 → `DefaultPreview`

### HtmlPreview (sandbox iframe)

Extension Pages の CSP により `new Function()` / `eval()` は不可。そのため `public/sandbox.html` を iframe で読み込み、`postMessage` で HTML を流し込んで `document.write()` + console 転送で実行する ([ADR-005](../decisions/005-extension-page-csp-constraints.md) 参照)。

## 自動展開のルール

`use-agent.ts` の `artifactAutoExpand.onReplCompleted`:

```ts
onReplCompleted: async (prevNames) => {
  await useStore.getState().loadArtifacts();
  const { artifacts } = useStore.getState();
  const newArtifact = artifacts.find((a) => !prevNames.has(a.name));
  if (!newArtifact) return;
  useStore.getState().selectArtifact(newArtifact.name);
  if (newArtifact.type === "html" || newArtifact.type === "markdown") {
    useStore.getState().setArtifactPanelOpen(true);
  }
};
```

- `loadArtifacts()` は `visible: true` の項目のみ slice に載るため、`visible: false` artifact は自動展開対象外
- 新規 visible artifact のうち `html` / `markdown` のみ Panel を自動で開く。それ以外 (json / image 等) は選択だけ行い、既存の Panel 状態を維持

## セッション分離

- Artifact は `sessionId` で isolation される
- `ArtifactStoragePort.setSessionId(sessionId)` を呼ぶと以降の put/get/list が対象セッションに限定される
- セッション切替時は `useStore.getState().loadArtifacts()` が新 sessionId 下の一覧を再取得 → UI が切り替わる

## 関連ドキュメント

- [ADR-007: artifact storage unification](../decisions/007-artifact-storage-unification.md) — 統一の経緯と決定
- [ADR-005: extension page CSP constraints](../decisions/005-extension-page-csp-constraints.md) — HtmlPreview の iframe 方針
- [sandbox-implementation.md](./sandbox-implementation.md) — REPL 用 sandbox iframe の詳細
- [bg-fetch.md](./bg-fetch.md) — bgFetch ループ + saveArtifact パターン

## 関連ソース

- `src/features/artifacts/ArtifactPanel.tsx` — Panel 本体
- `src/features/artifacts/ArtifactFileItem.tsx` — 行 + kind バッジ
- `src/features/artifacts/ArtifactPreview.tsx` — プレビュー分岐
- `src/features/artifacts/artifact-slice.ts` — Zustand slice
- `src/features/tools/providers/artifact-provider.ts` — REPL helper (`saveArtifact` 等)
- `src/features/tools/handlers/artifacts-handler.ts` — top-level `artifacts` tool
- `src/adapters/storage/artifact-storage.ts` — `ChromeArtifactStorage` (IndexedDB)
- `src/ports/artifact-storage.ts` — Port 定義
