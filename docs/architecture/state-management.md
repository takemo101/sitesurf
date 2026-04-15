# 状態管理設計

## 設計方針

**Zustand の単一ストアをfeatureごとのsliceに分割し、
永続化は `ports/storage` で抽象化する。
feature間の状態アクセスは orchestration 層が仲介する。**

## 状態の分類

### 揮発性 (メモリのみ)

| 状態                | 所属slice | 型               | 説明                       |
| ------------------- | --------- | ---------------- | -------------------------- |
| `messages`          | chat      | `ChatMessage[]`  | UI表示用チャット履歴       |
| `isStreaming`       | chat      | `boolean`        | AI応答中フラグ             |
| `history`           | chat      | `AIMessage[]`    | AI APIに送る会話履歴       |
| `currentTab`        | ui        | `TabInfo`        | アクティブタブ情報         |
| `pendingScreenshot` | ui        | `string \| null` | 次メッセージ添付用スクショ |
| `settingsOpen`      | ui        | `boolean`        | 設定パネル開閉             |

### 永続性 (ports/storage 経由)

| 状態             | 所属slice | 型                 | 説明                      |
| ---------------- | --------- | ------------------ | ------------------------- |
| `provider`       | settings  | `ProviderId`       | AIプロバイダー            |
| `model`          | settings  | `string`           | モデル名                  |
| `apiKey`         | settings  | `string`           | APIキー                   |
| `baseUrl`        | settings  | `string`           | ローカルLLMエンドポイント |
| `reasoningLevel` | settings  | `ReasoningLevel`   | 思考レベル設定            |
| `credentials`    | settings  | `AuthCredentials?` | OAuthトークン             |

`AuthCredentials` は Port の型 (`ports/auth-provider.ts`) をそのまま使用する。
ストア固有の別型は定義しない。

## slice構成とfeature対応

```
AppStore (単一Zustand store)
  ├─ ChatSlice        ← features/chat/chat-store.ts
  │   messages, history, isStreaming
  │   addMessage, appendDelta, addToolCall, pushHistory, clearAll
  │
  ├─ SettingsSlice    ← features/settings/settings-store.ts
  │   provider, model, apiKey, baseUrl, reasoningLevel, credentials
  │   setProvider, setModel, setApiKey, setCredentials
  │
  ├─ SessionSlice     ← features/sessions/session-store.ts
  │   sessions (メタ一覧), activeSessionId, activeSessionSnapshot
  │   createSession, switchSession, deleteSession, saveActiveSession, syncHistory
  │
  └─ UISlice          ← sidepanel/ui-store.ts
      settingsOpen, currentTab, pendingScreenshot
      toggleSettings, setTab, setPendingScreenshot
```

### history を ChatSlice に統合した理由

旧設計では ChatSlice (UI用) と HistorySlice (AI用) を分離していたが、
以下の理由で ChatSlice に統合する:

- 両者のライフサイクルは同一 (パネル閉じで消える)
- `addMessage` と `pushHistory` は常にペアで呼ばれる
- 別sliceに分けるとorchestration層が両方を同期管理する負担が増える
- 将来の要約・圧縮時は `history` フィールドだけを操作すれば十分

`messages` (UI表示用) と `history` (AI API用) は同一slice内で別フィールドとして管理する。

## 永続化

### Port定義

```typescript
// ports/storage.ts

export interface StoragePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
```

### Adapter

```typescript
// adapters/storage/chrome-storage.ts
export class ChromeStorageAdapter implements StoragePort {
  async get<T>(key: string): Promise<T | null> {
    const data = await chrome.storage.local.get([key]);
    return (data[key] as T) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}

// テスト用
export class InMemoryStorage implements StoragePort {
  private store = new Map<string, unknown>();
  async get<T>(key: string) {
    return (this.store.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T) {
    this.store.set(key, value);
  }
  async remove(key: string) {
    this.store.delete(key);
  }
}
```

### persistence.ts の配置と役割

`features/settings/persistence.ts` に配置する。
Settings の永続化は settings feature の関心事であるため。

```typescript
// features/settings/persistence.ts
import type { StoragePort } from "@/ports/storage";

const STORAGE_KEY = "tandemweb_settings";

export async function loadSettings(storage: StoragePort): Promise<SettingsData | null> {
  return storage.get<SettingsData>(STORAGE_KEY);
}

export async function saveSettings(storage: StoragePort, data: SettingsData): Promise<void> {
  await storage.set(STORAGE_KEY, data);
}
```

- StoragePort を引数で受け取る (Adapterに直接依存しない)
- 自動永続化 (Zustand middleware) は使わない
  - chrome.storage は非同期のため middleware での透過的永続化は複雑
  - 永続化タイミングを明示的に制御する (保存ボタン押下時)

### 永続化フロー

```
起動時:
  sidepanel/main.tsx
    → persistence.loadSettings(storageAdapter)
    → SettingsSlice に反映
    → APIキー未設定なら UISlice.settingsOpen = true

設定保存時:
  features/settings/SettingsPanel.tsx の保存ボタン
    → persistence.saveSettings(storageAdapter, currentSettings)
    → UISlice.settingsOpen = false

OAuth成功時:
  AuthProvider.login() 完了
    → SettingsSlice.setCredentials(credentials)
    → persistence.saveSettings() で自動的に永続化

ログアウト (Disconnect) 時:
  SettingsSlice.setCredentials(null)
    → persistence.saveSettings() で永続化
```

## セッション管理

会話履歴はセッションとして IndexedDB に永続化する。

### 永続化の責務分離

| データ                | Port                 | Adapter                   | ストレージ           |
| --------------------- | -------------------- | ------------------------- | -------------------- |
| 設定 (apiKey等)       | `StoragePort`        | `ChromeStorageAdapter`    | chrome.storage.local |
| セッション (会話履歴) | `SessionStoragePort` | `IndexedDBSessionStorage` | IndexedDB            |

### syncHistory の動作

`syncHistory` アクションは会話履歴を同期する際に、`activeSessionSnapshot.history` と `messages` の両方を同時に更新する。
これにより、UI表示とセッションスナップショットの一貫性を保つ。

### セッション復元

セッション復元時は IndexedDB から history を読み込み、`buildMessagesForAPI` に渡して API 送信用メッセージを再構築する。

## Adapter注入の仕組み

React Context で Adapter を注入する。

```typescript
// sidepanel/DepsContext.tsx
import { createContext, useContext } from "react";

export interface AppDeps {
  aiProvider: AIProvider;
  authProviders: Record<string, AuthProvider>;
  browserExecutor: BrowserExecutor;
  storage: StoragePort;
}

const DepsContext = createContext<AppDeps | null>(null);

export const DepsProvider = DepsContext.Provider;
export const useDeps = () => {
  const deps = useContext(DepsContext);
  if (!deps) throw new Error("DepsProvider not found");
  return deps;
};
```

```typescript
// sidepanel/main.tsx
const deps: AppDeps = {
  aiProvider: new VercelAIAdapter(),
  authProviders: {
    openai: new OpenAIAuth(browserExecutor),
    copilot: new CopilotAuth(browserExecutor),
  },
  browserExecutor: new ChromeBrowserExecutor(),
  storage: new ChromeStorageAdapter(),
};

root.render(
  <DepsProvider value={deps}>
    <MantineProvider ...>
      <App />
    </MantineProvider>
  </DepsProvider>
);
```

テスト時:

```typescript
const mockDeps: AppDeps = {
  aiProvider: new MockAIProvider(),
  authProviders: {},
  browserExecutor: new MockBrowserExecutor(),
  storage: new InMemoryStorage(),
};
```

## Zustand セレクター規約

```typescript
// ✅ 個別セレクター
const messages = useStore((s) => s.messages);

// ✅ アクション取得 (アクションは参照安定なのでdestructuring可)
const { addMessage, appendDelta } = useStore.getState();

// ✅ イベントハンドラ内でgetState() (stale closure回避)
const toggle = () => {
  const { settingsOpen, setSettingsOpen } = useStore.getState();
  setSettingsOpen(!settingsOpen);
};

// ❌ レンダリング時のdestructuring (不要な再レンダリング)
const { messages, isStreaming } = useStore();
```

## feature間の型共有ルール

各featureは自身の `types.ts` を持つ。feature間で共有する型は以下のルールに従う:

| 型の種類               | 配置場所                  | 例                                              |
| ---------------------- | ------------------------- | ----------------------------------------------- |
| Port の引数・戻り値型  | `ports/*.ts` 内           | `PageContent`, `ElementInfo`, `AuthCredentials` |
| メッセージプロトコル型 | `shared/message-types.ts` | `BackgroundRequest`, `BackgroundResponse`       |
| エラー型               | `shared/errors.ts`        | `AppError`, `ToolError`                         |
| feature固有の型        | `features/*/types.ts`     | `ChatMessage`, `ToolCallInfo`                   |
| ProviderId 等の定数    | `shared/constants.ts`     | `ProviderId` union type                         |

**shared/ に型を追加する基準**: 3つ以上のモジュールから参照される型のみ。
2つのモジュール間なら、依存先のモジュールに型を置く。

### コンテキスト圧縮

長い会話は `orchestration/context-compressor.ts` が古いメッセージを要約する。
詳細は [セッション管理 詳細設計](../design/session-management-detail.md) を参照。

## 関連ドキュメント

- [概要](./overview.md)
- [パッケージ構成](./package-structure.md) - store sliceの配置
- [AI接続設計](./ai-connection.md) - AuthCredentials の永続化
- [エラーハンドリング](./error-handling.md) - shared/errors.ts
- [セッション管理 詳細設計](../design/session-management-detail.md) - 永続化、圧縮、UI
