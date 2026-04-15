# アーティファクトパネル 詳細設計

## 概要

AIが `createOrUpdateArtifact` / `returnFile` で保存したデータをユーザーが確認・プレビューできる UI を追加する。
既存拡張 の **Flex side-by-side** パターンを採用し、アーティファクトがある場合のみ右パネルを表示する。

## 既存拡張 との対応関係

| 既存拡張                         | TandemWeb                                    | 差分                             |
| -------------------------------- | -------------------------------------------- | -------------------------------- |
| LitElement `@state`              | Zustand `ArtifactSlice`                      | フレームワーク差異のみ           |
| `ArtifactsPanel` (Web Component) | `ArtifactPanel.tsx` (React)                  | 同等機能を React で再実装        |
| `ArtifactsRuntimeProvider`       | 既存 `repl.ts` (変更なし)                    | sandbox ↔ storage 連携は実装済み |
| `sandboxUrlProvider`             | 既存 `chrome.runtime.getURL("sandbox.html")` | 変更なし                         |

## 現状確認（実装済みの範囲）

以下は**すでに実装済み**であり、今回の実装では変更不要。

- `src/shared/deps-context.tsx`: `artifactStorage: ArtifactStoragePort` を持つ `AppDeps` 定義済み
- `src/sidepanel/main.tsx`: `ChromeArtifactStorage` の生成・`AppDeps` への注入済み
- `src/ports/artifact-storage.ts`: `ArtifactStoragePort` インターフェース定義済み
- `src/adapters/storage/artifact-storage.ts`: `ChromeArtifactStorage` 実装済み
- `public/sandbox.html`: `createOrUpdateArtifact` / `returnFile` などの API 済み

## アーキテクチャ上の位置づけ

```
features/artifacts/
  artifact-slice.ts      ← ArtifactSlice (Zustand)
  ArtifactPanel.tsx      ← アーティファクト一覧 + プレビュー
  ArtifactFileItem.tsx   ← 1 ファイル分の行コンポーネント
  ArtifactPreview.tsx    ← ファイル種別ごとのプレビュー
  types.ts               ← ArtifactEntry 型
```

`features/artifacts/` は `ports/artifact-storage.ts` にのみ依存し、Adapter には依存しない。

## レイアウト設計

### アーティファクトなし（通常時）

```
┌─── 400px ──────────────────────┐
│ Header                          │
├─────────────────────────────────┤
│ SettingsPanel (Collapse)        │
├─────────────────────────────────┤
│ TabBar                          │
├─────────────────────────────────┤
│                                 │
│ ChatArea (flex:1)               │
│                                 │
├─────────────────────────────────┤
│ InputArea                       │
└─────────────────────────────────┘
```

### アーティファクトあり（分割表示）

```
┌─── 400px ──────────────────────┐
│ Header                          │
├─────────────────────────────────┤
│ SettingsPanel (Collapse)        │
├─────────────────────────────────┤
│ TabBar                          │
├──────────────┬──────────────────┤
│              │ [📄] results.json│
│ ChatArea     │ [🌐] chart.html  │
│ (flex:1,     │ [📝] memo.md     │
│  minWidth:0) ├──────────────────┤
│              │ [プレビューエリア]│
│              │ (flex:1,        │
│              │  overflow:auto)  │
├──────────────┴──────────────────┤
│ InputArea                       │
└─────────────────────────────────┘

ChatArea: flex={1}, minWidth: 0 (現状の ScrollArea flex={1} を維持)
ArtifactPanel: width 180px, flexShrink: 0
```

### 分割の実装方針

- `ChatArea` の現行 props は `{ onSend?: (text: string) => void }` のみ。`style` prop はない。
- 分割の flex 制御は `MainLayout` 内のラッパー `Group` で行い、`ChatArea` には style を渡さない。
- `ChatArea` の `ScrollArea flex={1}` はそのまま維持し、ラッパー `Box` 内で `flex: 1` になるよう包む。
- `artifactPanelOpen`（UISlice 拡張）が `true` かつアーティファクトが 1 件以上のときのみ ArtifactPanel を表示。
- アーティファクトが 0 件になったら自動で `artifactPanelOpen = false`。

### ChatArea ラッパーの構造

```tsx
// MainLayout 内
<Group gap={0} style={{ flex: 1, overflow: "hidden", alignItems: "stretch" }}>
  {/* ChatArea を Box で包み、flex:1 を Box 側に設定する */}
  <Box
    style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
  >
    <ChatArea onSend={handleSend} />
  </Box>
  {showArtifacts && <ArtifactPanel />}
</Group>
```

## Port への追加

`returnFile` で保存したファイルには削除機能がないため、`ArtifactStoragePort` に `deleteFile` を追加する。

```typescript
// ports/artifact-storage.ts に追加
export interface ArtifactStoragePort {
  // ... 既存のメソッド ...
  deleteFile(name: string): Promise<void>; // 追加
}
```

```typescript
// adapters/storage/artifact-storage.ts に実装追加
async deleteFile(name: string): Promise<void> {
  const key = FILE_PREFIX + sanitizeKey(name);
  await chrome.storage.local.remove(key);
}
```

## 状態管理設計

### ArtifactSlice

```typescript
// features/artifacts/artifact-slice.ts

export interface ArtifactSlice {
  artifacts: ArtifactEntry[]; // アーティファクト一覧（メタデータのみ）
  selectedArtifact: string | null; // 選択中のファイル名

  loadArtifacts(): Promise<void>; // storage から一覧を再取得
  selectArtifact(name: string): void;
  removeArtifact(name: string): Promise<void>;
  clearArtifacts(): Promise<void>;
}
```

**ArtifactEntry にデータ本体は持たない。** ファイル一覧はメタデータのみ store に保持し、
プレビュー表示時に `ArtifactStoragePort` から都度取得する（ファイル内容が大きい場合も安全）。

### UISlice 拡張

```typescript
// sidepanel/ui-store.ts に追加
artifactPanelOpen: boolean;
setArtifactPanelOpen(v: boolean): void;
toggleArtifactPanel(): void;
```

### store への統合

`store/index.ts` は現在 `create()` 内で 4 slice を合成している。
`ArtifactSlice` は `ArtifactStoragePort` を必要とするため、クロージャパターンで注入する。

```typescript
// store/types.ts
import type { ArtifactSlice } from "@/features/artifacts/artifact-slice";
export type AppStore = ChatSlice & SettingsSlice & SessionSlice & UISlice & ArtifactSlice;
```

```typescript
// store/index.ts
import { create } from "zustand";
import { createArtifactSlice } from "@/features/artifacts/artifact-slice";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";

// artifactStorage は main.tsx から initStore() 経由で注入する
let _artifactStorage: ArtifactStoragePort;

export function initStore(artifactStorage: ArtifactStoragePort): void {
  _artifactStorage = artifactStorage;
}

export const useStore = create<AppStore>()((...a) => ({
  ...createChatSlice(...a),
  ...createSettingsSlice(...a),
  ...createSessionSlice(...a),
  ...createUISlice(...a),
  ...createArtifactSlice(() => _artifactStorage)(...a),
}));
```

> **注意**: `useStore` は変更しない。`_artifactStorage` のみモジュール内変数として管理する。
> `initStore()` は `main.tsx` の `createRoot` より前に呼ぶ必要がある。

### ArtifactSlice 実装

```typescript
// features/artifacts/artifact-slice.ts
export function createArtifactSlice(
  getStorage: () => ArtifactStoragePort,
): StateCreator<AppStore, [], [], ArtifactSlice> {
  return (set, get) => ({
    artifacts: [],
    selectedArtifact: null,

    loadArtifacts: async () => {
      const storage = getStorage();
      const [jsonNames, fileNames] = await Promise.all([storage.list(), storage.listFiles()]);
      // 重複除去: json/file 両方に同名ファイルがあり得るので Set で管理
      const seen = new Set<string>();
      const entries: ArtifactEntry[] = [];
      for (const name of jsonNames) {
        if (!seen.has(name)) {
          seen.add(name);
          entries.push({ name, type: detectType(name), updatedAt: Date.now() });
        }
      }
      for (const name of fileNames) {
        if (!seen.has(name)) {
          seen.add(name);
          entries.push({ name, type: detectType(name), updatedAt: Date.now() });
        }
      }
      set({ artifacts: entries });
    },

    selectArtifact: (name) => set({ selectedArtifact: name }),

    removeArtifact: async (name) => {
      const storage = getStorage();
      const entry = get().artifacts.find((a) => a.name === name);
      if (!entry) return;
      // ファイル種別に応じた削除先を選択
      if (entry.type === "image" || entry.type === "binary" || entry.type === "html") {
        await storage.deleteFile(name);
      } else {
        await storage.delete(name);
      }
      set((s) => ({
        artifacts: s.artifacts.filter((a) => a.name !== name),
        selectedArtifact: s.selectedArtifact === name ? null : s.selectedArtifact,
      }));
    },

    clearArtifacts: async () => {
      await getStorage().clearAll();
      set({ artifacts: [], selectedArtifact: null });
    },
  });
}
```

## アーティファクト更新の検知

AIが `createOrUpdateArtifact`（JSON）または `returnFile`（ファイル）を呼び出した後、パネルに反映するトリガーが必要。

### トリガー条件

`result.files` は `returnFile()` で保存したファイルのみを返す。`createOrUpdateArtifact()` で保存した JSON は含まれない。
どちらの API を呼び出しても store に反映するため、**repl ツールが成功したら常に** `loadArtifacts()` を呼ぶ。

### 更新フロー

```
[AI] createOrUpdateArtifact() または returnFile() 呼び出し
  ↓
repl.ts: artifactStorage.createOrUpdate() / saveFile() 実行
  ↓
exec-result メッセージ受信
  ↓
orchestration/agent-loop.ts: executeToolCall 内でツール結果処理
  ↓
useStore.getState().loadArtifacts()   ← JSON + File 両方を再取得
  ↓
artifacts.length > 0 なら setArtifactPanelOpen(true)
```

### 実装箇所

```typescript
// orchestration/agent-loop.ts の executeToolCall 内（変更箇所のみ）
if (name === "repl" && toolResult.ok) {
  await useStore.getState().loadArtifacts();
  const { artifacts } = useStore.getState();
  if (artifacts.length > 0) {
    useStore.getState().setArtifactPanelOpen(true);
  }
}
```

> **負荷について**: `loadArtifacts()` は `chrome.storage.local.get(null)` を 2 回呼ぶ（list + listFiles）。
> repl ツールの毎回呼び出しに実行されるが、データ量が少ない Chrome 拡張実装では許容範囲内。

## UIコンポーネント設計

### コンポーネントツリー

```
MainLayout (App.tsx)
├── Group (flex:1, overflow:hidden)
│   ├── Box (flex:1, minWidth:0, flexDir:column)  ← ChatArea のラッパー
│   │   └── ChatArea
│   └── ArtifactPanel (w:180px, flexShrink:0)  ← artifactPanelOpen && artifacts.length > 0 時のみ
│       ├── ArtifactPanelHeader (「Artifacts」 + CloseButton)
│       ├── ScrollArea (mah:120px)  ← ファイル一覧
│       │   └── ArtifactFileItem[]
│       └── Box (flex:1, overflow:auto, minHeight:0)  ← プレビュー
│           ├── JsonPreview
│           ├── HtmlPreview
│           ├── MarkdownPreview
│           ├── ImagePreview
│           └── TextPreview
└── InputArea
```

### ArtifactPanel

```tsx
// features/artifacts/ArtifactPanel.tsx

export function ArtifactPanel() {
  const artifacts = useStore((s) => s.artifacts);
  const selectedArtifact = useStore((s) => s.selectedArtifact);
  const setArtifactPanelOpen = useStore((s) => s.setArtifactPanelOpen);

  // アーティファクトが 0 件になったらパネルを自動クローズ
  useEffect(() => {
    if (artifacts.length === 0) {
      setArtifactPanelOpen(false);
    }
  }, [artifacts.length, setArtifactPanelOpen]);

  return (
    <Stack
      w={180}
      gap={0}
      style={{
        borderLeft: "1px solid var(--mantine-color-default-border)",
        flexShrink: 0,
        overflow: "hidden",
        // 親 Group の alignItems: stretch により高さは自動計算
      }}
    >
      {/* ヘッダー */}
      <Group
        px="xs"
        py={4}
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Text size="xs" fw={600}>
          Artifacts
        </Text>
        <ActionIcon variant="subtle" size="xs" onClick={() => setArtifactPanelOpen(false)}>
          <X size={10} />
        </ActionIcon>
      </Group>

      {/* ファイル一覧 */}
      <ScrollArea mah={120} style={{ flexShrink: 0 }}>
        <Stack gap={0}>
          {artifacts.map((artifact) => (
            <ArtifactFileItem
              key={artifact.name}
              artifact={artifact}
              selected={selectedArtifact === artifact.name}
            />
          ))}
        </Stack>
      </ScrollArea>

      {/* プレビュー */}
      <Box style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {selectedArtifact ? (
          <ArtifactPreview name={selectedArtifact} />
        ) : (
          <Stack align="center" justify="center" h="100%">
            <Text size="xs" c="dimmed" ta="center" px="xs">
              ファイルを選択
            </Text>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
```

### ArtifactFileItem

```tsx
// features/artifacts/ArtifactFileItem.tsx

const TYPE_ICONS: Record<ArtifactEntry["type"], React.ReactNode> = {
  json: <Braces size={10} />,
  html: <Globe size={10} />,
  markdown: <FileText size={10} />,
  text: <FileText size={10} />,
  image: <ImageIcon size={10} />,
  binary: <File size={10} />,
};

export function ArtifactFileItem({
  artifact,
  selected,
}: {
  artifact: ArtifactEntry;
  selected: boolean;
}) {
  const selectArtifact = useStore((s) => s.selectArtifact);
  const removeArtifact = useStore((s) => s.removeArtifact);

  return (
    <UnstyledButton
      onClick={() => selectArtifact(artifact.name)}
      px="xs"
      py={4}
      style={{
        background: selected ? "var(--mantine-color-indigo-light)" : undefined,
        display: "flex",
        alignItems: "center",
        gap: 4,
        width: "100%",
      }}
      className="hover-highlight"
    >
      <Box c="dimmed" style={{ flexShrink: 0 }}>
        {TYPE_ICONS[artifact.type]}
      </Box>
      <Text size="10px" truncate style={{ flex: 1 }}>
        {artifact.name}
      </Text>
      <ActionIcon
        variant="subtle"
        size="xs"
        color="red"
        className="show-on-hover"
        onClick={(e) => {
          e.stopPropagation();
          removeArtifact(artifact.name);
        }}
      >
        <Trash2 size={8} />
      </ActionIcon>
    </UnstyledButton>
  );
}
```

### ArtifactPreview

```tsx
// features/artifacts/ArtifactPreview.tsx

export function ArtifactPreview({ name }: { name: string }) {
  const [content, setContent] = useState<string | object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deps = useDeps();
  const artifact = useStore((s) => s.artifacts.find((a) => a.name === name));

  useEffect(() => {
    setLoading(true);
    setContent(null);
    setError(null);
    if (!artifact) return;

    let cancelled = false;
    const load = async () => {
      try {
        if (artifact.type === "json") {
          const data = await deps.artifactStorage.get(name);
          if (!cancelled) setContent(data as object);
        } else {
          const file = await deps.artifactStorage.getFile(name);
          if (!cancelled && file) setContent(file.contentBase64);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%" p="xs">
        <Loader size="xs" color="indigo" />
      </Stack>
    );
  }
  if (error) {
    return (
      <Text size="10px" c="red" p="xs">
        {error}
      </Text>
    );
  }
  if (!artifact || content === null) return null;

  switch (artifact.type) {
    case "json":
      return <JsonPreview data={content as object} />;
    case "html":
      return <HtmlPreview base64={content as string} />;
    case "markdown":
      return <MarkdownPreview base64={content as string} />;
    case "image":
      return <ImagePreview base64={content as string} mimeType={getMimeType(name)} />;
    default:
      return <TextPreview base64={content as string} />;
  }
}
```

**変更点**: `name` のみを `useEffect` の依存配列に含める（`artifact` は派生値のため不要）。キャンセルフラグで競合防止。

### プレビュー種別ごとの実装

#### JsonPreview

```tsx
function JsonPreview({ data }: { data: object }) {
  return (
    <Box p="xs">
      <Code block style={{ fontSize: 9, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {JSON.stringify(data, null, 2)}
      </Code>
    </Box>
  );
}
```

#### HtmlPreview

Chrome 拡張の Content Security Policy 制約下では `blob:` URL が機能しない場合がある。
`<iframe srcDoc>` は Manifest V3 で動作することが確認されており、コード実行なしの安全な表示には `sandbox` 属性なしで使用する。
スクリプト実行が必要な場合は `sandbox="allow-scripts"` を追加するが、プレビュー目的なら機能しないリスクより表示を優先する。

```tsx
function HtmlPreview({ base64 }: { base64: string }) {
  const html = atob(base64);
  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100%", minHeight: 120, border: "none" }}
      title="HTML Preview"
    />
  );
}
```

#### MarkdownPreview

```tsx
function MarkdownPreview({ base64 }: { base64: string }) {
  const text = useMemo(
    () => new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))),
    [base64],
  );
  return (
    <Box p="xs">
      <MarkdownContent content={text} />
    </Box>
  );
}
```

#### ImagePreview

```tsx
function ImagePreview({ base64, mimeType }: { base64: string; mimeType: string }) {
  return (
    <Box p="xs">
      <img
        src={`data:${mimeType};base64,${base64}`}
        alt="artifact"
        style={{ maxWidth: "100%", borderRadius: 4 }}
      />
    </Box>
  );
}
```

#### TextPreview

```tsx
function TextPreview({ base64 }: { base64: string }) {
  const text = useMemo(
    () => new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))),
    [base64],
  );
  return (
    <Box p="xs">
      <Code block style={{ fontSize: 9, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {text}
      </Code>
    </Box>
  );
}
```

## ファイル種別の自動判定

```typescript
// features/artifacts/types.ts

export type ArtifactType = "json" | "html" | "markdown" | "text" | "image" | "binary";

export interface ArtifactEntry {
  name: string;
  type: ArtifactType;
  updatedAt: number;
}

const EXT_MAP: Record<string, ArtifactType> = {
  json: "json",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  csv: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
};

export function detectType(name: string): ArtifactType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "binary";
}

export function getMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const MIME: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return MIME[ext] ?? "application/octet-stream";
}
```

## セッション切替時のリセット

`session-slice.ts` の `loadSession` にアーティファクトリセットを追加する。

```typescript
// features/sessions/session-slice.ts の loadSession 内（変更箇所のみ）
loadSession: (session) => {
  set({
    activeSessionSnapshot: session,
    activeSessionId: session.id,
    messages: session.messages,
    history: session.history,
  });
  // アーティファクトリストをリセットして再読込
  useStore.getState().setArtifactPanelOpen(false);
  // loadArtifacts は非同期なので void で呼び出す
  void useStore.getState().loadArtifacts();
},
```

> **考慮**: `loadSession` は現状同期関数。`loadArtifacts` は非同期なので、パネルを閉じてから読み込むことで移行を自然に見せる。

> **備考**: 現状 `ChromeArtifactStorage` はセッション横断でデータを共有。セッション分離は v2 以降の拡張で対応する。

## ファイル追加・変更一覧

| ファイル                                      | 変更種別 | 内容                                                         |
| --------------------------------------------- | -------- | ------------------------------------------------------------ |
| `src/ports/artifact-storage.ts`               | 変更     | `deleteFile(name)` メソッドを Port に追加                    |
| `src/adapters/storage/artifact-storage.ts`    | 変更     | `deleteFile` 実装を追加                                      |
| `src/features/artifacts/types.ts`             | 新規     | `ArtifactEntry`, `ArtifactType`, `detectType`, `getMimeType` |
| `src/features/artifacts/artifact-slice.ts`    | 新規     | `ArtifactSlice`, `createArtifactSlice`                       |
| `src/features/artifacts/ArtifactPanel.tsx`    | 新規     | パネル本体 (一覧 + プレビュー制御)                           |
| `src/features/artifacts/ArtifactFileItem.tsx` | 新規     | 1 ファイル行 UI                                              |
| `src/features/artifacts/ArtifactPreview.tsx`  | 新規     | プレビュー種別切替                                           |
| `src/store/types.ts`                          | 変更     | `ArtifactSlice` を `AppStore` に追加                         |
| `src/store/index.ts`                          | 変更     | `initStore()` + `createArtifactSlice` を追加                 |
| `src/sidepanel/App.tsx`                       | 変更     | `MainLayout` に `Box` ラッパー + `ArtifactPanel` を組み込み  |
| `src/sidepanel/ui-store.ts`                   | 変更     | `artifactPanelOpen` + 操作関数を追加                         |
| `src/sidepanel/main.tsx`                      | 変更     | `initStore(artifactStorage)` を呼び出す                      |
| `src/orchestration/agent-loop.ts`             | 変更     | repl 成功後に `loadArtifacts()` を呼ぶ                       |
| `src/features/sessions/session-slice.ts`      | 変更     | `loadSession` 内にアーティファクトリセットを追加             |

## 関連ドキュメント

- [アーキテクチャ概要](../architecture/overview.md)
- [状態管理設計](../architecture/state-management.md)
- [DI 注入設計](./di-wiring.md)
- [ツール設計](../architecture/tools.md)
- [UI/UX 設計](./ui-ux-design.md)
