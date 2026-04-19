# 007: Artifact ストレージを単一ストアに統合する

## 状態

承認済（2026-04 / v0.1.6 を目標に実装 PR を別途起票）

## 文脈

現在の Artifact 関連機能は 1 つの `ArtifactStoragePort` の背後に **2 つのバックエンドストア**を持つ構造になっている。

- **JSON store** — `createOrUpdate / get / list / delete`（任意の JS 値を保存）
- **File store** — `saveFile / getFile / listFiles / deleteFile`（base64 + mimeType）

REPL helper / top-level `artifacts` tool のインターフェイスは以下のようにストアごとに分かれている:

| helper | 保存先 | 読める範囲 |
| --- | --- | --- |
| `createOrUpdateArtifact(name, data)` | JSON store | JSON store のみ |
| `getArtifact(name)` / `listArtifacts()` / `deleteArtifact(name)` | JSON store のみ | JSON store のみ |
| `returnFile(name, content, mimeType)` | File store | **REPL 側から読み戻す手段なし** |
| top-level `artifacts` tool (`create`/`update`/`rewrite`/`get`/`delete`) | 拡張子で自動判別（`.json` → JSON store、他 → File store） | 両方（Zustand slice が両ストアをマージ読み込み） |

### 観測された問題（v0.1.5 時点 / 実測）

AI エージェントが以下のパターンで頻繁に混乱する:

1. `returnFile("game.html", html)` で保存した直後に `getArtifact("game.html")` を呼んで「not found」エラー
2. その結果、AI が「消えた？」と判断して HTML を再生成 → トークン浪費 + MAX_TURNS 消費
3. REPL 内でバイナリを保存 → 同 REPL 内で読み戻す手段がなく、次ターンの top-level `artifacts` tool まで待つ
4. `listArtifacts()` に File store の内容が出ないため、AI が自分の保存物を発見できない
5. `createOrUpdateArtifact` vs `returnFile` の命名が対称でなく、どちらを使うべきかの判断でしばしば誤る

根本原因は「**AI が保存場所を意識する必要がある**」構造にある。`ArtifactStoragePort` の API が 8 メソッドに膨らみ、REPL helper と top-level tool でルーティング方針が別々で、description に 2 store 構造が明記されていないことも拍車をかけている。

### 検討した選択肢

#### 案 A: API 対称化のみ（最小修正）

`getFile()` / `listFiles()` を REPL helper に追加し、description に「2 つのストアがある」と明記する。
実害の 8 割は消えるが、**2 ストア構造自体が温存される** ため AI が「どちらに保存したか」を覚え続ける必要がある。長期的には別の混乱を生む。

#### 案 B: 意図分離（scratch vs artifact）

`scratch.*` と `artifact.*` の 2 ネームスペースに分け、意図（内部利用 vs ユーザー配送）で使い分ける。
人間のコードレビュアー視点では美しいが、**AI に分類判断を毎回強いる**ため、意図が曖昧なケースで迷いが増える。移動操作（scratch → artifact への昇格）という新たな複雑性も生まれる。

#### 案 C: 単一ストア化（本 ADR の推奨）

IndexedDB レベルで 1 object store に統合し、REPL helper を `saveArtifact / getArtifact / listArtifacts / deleteArtifact` の 4 本に絞る。値の種別（JSON / file）は保存時に自動判別し、取得時は保存した形をそのまま返す。UI 表示の ON/OFF は別軸の `visible` フラグで制御し、「どこに保存されたか」とは分離する。

## 決定

**案 C（単一ストア化）を採用する。**

### 新 Port 設計

```ts
export type ArtifactKind = "json" | "file";

export interface ArtifactMeta {
  name: string;
  kind: ArtifactKind;
  mimeType?: string;   // kind === "file" のみ
  size: number;        // bytes (file) / JSON.stringify bytes (json)
  visible: boolean;    // UI の Artifact Panel に出すか
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

### 新 REPL helper

```js
// 保存 - 型は自動判別
await saveArtifact("data.json", { foo: 1 });           // object → kind:"json"
await saveArtifact("page.html", htmlString);           // string + 拡張子 → kind:"file"
await saveArtifact("icon.png", uint8Array);            // bytes → kind:"file"
await saveArtifact("debug.json", dbg, { visible: false }); // Panel に出さない

// 取得 - 保存した形そのまま返る
const data = await getArtifact("data.json");     // { foo: 1 }
const html = await getArtifact("page.html");     // string
const img  = await getArtifact("icon.png");      // Uint8Array

// 一覧 - 全部入り
await listArtifacts(); // [{name, kind, mimeType, size, visible, ...}, ...]

await deleteArtifact("data.json");
```

### top-level `artifacts` tool

同じ `ArtifactStoragePort` を向けるよう統一する。拡張子による storage 分岐ロジック（`artifacts-handler.ts` 内の `type === "json"` 判定）は廃止し、`put/get/list/delete` の 1 経路に統一する。

### マイグレーション

初回起動時に、旧 JSON store / 旧 File store の両テーブルから統合テーブルへデータを移行し、旧テーブルを削除する。名前衝突は「File store を優先」で解決（配送物としての実体を優先）し、衝突があった場合は AI にわかるよう `migration-notes.json` に記録する。

## 結果

### 良い面

- AI の mental model が 1 つになる（「名前で put/get/list/delete」）
- `listArtifacts()` で保存物が全て見える → AI が自分の状態を失わない
- REPL 内で `returnFile` 相当の後に即 `getArtifact` で読み戻せる → ワンショット編集ループが書ける
- `ArtifactStoragePort` の API 表面積が 8 メソッド → 6 メソッドに縮小
- description が単純化され、プロンプト全体の token 消費が下がる
- top-level `artifacts` tool の拡張子判定が不要 → バグ余地が減る

### 悪い面

- 破壊的変更: `createOrUpdateArtifact` / `getArtifact`（旧版）/ `returnFile` の動作・戻り値が変わる
  - 旧名 API は deprecated wrapper として 1 バージョンだけ残し、v0.1.7 で削除する
- マイグレーションコードの追加 + 初回起動時のマイグレーション失敗リスク
- system prompt / REPL description / ドキュメントの書き換えが必要（非小規模）
- テスト書き換え規模大（artifact-slice / artifact-provider / artifacts-handler / integration 系）

### 中立

- UI 表示制御が `visible` フラグに一元化される。現在「ユーザーに見せる」が実質 File store のみだった挙動を、JSON 値にも拡張できる
- `Artifact Panel` 側は `list()` の `visible: true` だけを表示するフィルタに変更

## 実装段階

1. **ADR 確定**（本ドキュメント）
2. **Port 再設計**: `ports/artifact-storage.ts` を新 API に置き換え、Adapter を unified store 対応へ更新
3. **マイグレーション**: 初回起動時の旧テーブル → 新テーブル移行処理
4. **ArtifactProvider 書き換え**: 新 helper を提供し、旧 helper は deprecation 警告 + 新 API へ forward
5. **top-level artifacts tool 書き換え**: 拡張子判定廃止
6. **UI 更新**: Panel が `visible: true` のみ表示、`kind` 表示対応
7. **description / system prompt 書き換え**: 新 4 本の helper を唯一の説明として提示
8. **テスト全面更新** + **手動 smoke test**（HTML artifact 作成・ダウンロード・編集ループ）

## 関連 PR / Issue

- ADR 提案 PR: TBD
- 実装 PR: TBD（複数に分割予定）

## 参考

- [docs/architecture/overview.md](../architecture/overview.md) の Artifact 関連セクション
- [src/ports/artifact-storage.ts](../../src/ports/artifact-storage.ts) — 現在の Port
- [src/features/tools/providers/artifact-provider.ts](../../src/features/tools/providers/artifact-provider.ts) — REPL helper 実装
- [src/features/tools/handlers/artifacts-handler.ts](../../src/features/tools/handlers/artifacts-handler.ts) — top-level tool 実装
