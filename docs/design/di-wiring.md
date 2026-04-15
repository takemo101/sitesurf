# DI / ワイヤリング設計

## 概要

Adapter・Port・Feature の結合方法、DepsContext の構成、生成タイミングを定める。

## 依存注入の全体像

```
sidepanel/main.tsx (Composition Root)
  │
  │ (1) Adapter インスタンスを生成
  │ (2) DepsProvider で React ツリーに注入
  │ (3) Zustand store を初期化 (persistence.loadSettings)
  │ (4) Session を復元 (SessionStoragePort.getLatestSession)
  │
  ▼
<DepsProvider value={deps}>
  <MantineProvider>
    <App />
  </MantineProvider>
</DepsProvider>
```

## AppDeps 型

```typescript
// sidepanel/DepsContext.tsx

export interface AppDeps {
  // Ports の具体実装
  createModelFactory: (config: ProviderConfig) => (modelId: string) => LanguageModel;
  authProviders: Record<string, AuthProvider>;
  browserExecutor: BrowserExecutor;
  storage: StoragePort;
  sessionStorage: SessionStoragePort;
}

const DepsContext = createContext<AppDeps | null>(null);
export const DepsProvider = DepsContext.Provider;
export const useDeps = (): AppDeps => {
  const deps = useContext(DepsContext);
  if (!deps) throw new Error("DepsProvider not found. Wrap App with DepsProvider.");
  return deps;
};
```

## Composition Root

```typescript
// sidepanel/main.tsx

import { createModelFactory } from "@/adapters/ai/provider-factory";
import { OpenAIAuth } from "@/adapters/auth/openai-auth";
import { CopilotAuth } from "@/adapters/auth/copilot-auth";
import { ChromeBrowserExecutor } from "@/adapters/chrome/chrome-browser-executor";
import { ChromeStorageAdapter } from "@/adapters/storage/chrome-storage";
import { IndexedDBSessionStorage } from "@/adapters/storage/indexeddb-session-storage";

// async IIFE でラップ (トップレベル await はビルド出力形式によっては使えないため)
(async () => {
  // (1) Adapter 生成
  const browserExecutor = new ChromeBrowserExecutor();
  const storage = new ChromeStorageAdapter();
  const sessionStorage = new IndexedDBSessionStorage();

  const deps: AppDeps = {
    createModelFactory,
    authProviders: {
      openai: new OpenAIAuth(browserExecutor),
      copilot: new CopilotAuth(browserExecutor),
    },
    browserExecutor,
    storage,
    sessionStorage,
  };

  // (2) Background との接続 (セッションロック用)
  const windowId = (await chrome.windows.getCurrent()).id!;
  chrome.runtime.connect({ name: `sidepanel:${windowId}` });

  // (3) React マウント
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <DepsProvider value={deps}>
      <MantineProvider defaultColorScheme="auto" theme={mantineTheme}>
        <Notifications />
        <App />
      </MantineProvider>
    </DepsProvider>
  );
})();
```

## 各レイヤからの依存アクセス

### features/ → Port 経由 (useDeps)

```typescript
// features/settings/SettingsPanel.tsx
function SettingsPanel() {
  const { authProviders, storage } = useDeps();
  // ...
  const handleOAuth = async () => {
    const auth = authProviders[settings.provider];
    const result = await auth.login({ onDeviceCode: setDeviceCode });
    // ...
  };
}
```

### orchestration/ → 引数で受け取り

```typescript
// orchestration/agent-loop.ts
// deps は App.tsx から引数で渡される (useDeps は React Hook なので直接使えない)

export async function runAgentLoop(params: AgentLoopDeps): Promise<void> {
  const { deps } = params;
  const aiResult = await resolveAIProvider(settings, deps);
  // ...
}
```

```typescript
// sidepanel/App.tsx
function App() {
  const deps = useDeps();
  const handleSend = async (text: string) => {
    await runAgentLoop({
      deps,
      chatStore: useStore.getState(),
      settings: useStore.getState().settings,
      // ...
    });
  };
}
```

### features/sessions/ → 関数引数で DI

```typescript
// features/sessions/auto-save.ts
// useStore.getState を直接importせず、getState 関数を引数で受け取る
export function createAutoSaver(
  sessionStorage: SessionStoragePort,
  getState: () => { ... },
) { ... }
```

```typescript
// sidepanel/App.tsx
const autoSaver = useMemo(
  () => createAutoSaver(deps.sessionStorage, () => useStore.getState()),
  [deps.sessionStorage],
);
```

## テスト時の差替え

```typescript
// __tests__/helpers/test-deps.ts

export function createTestDeps(overrides?: Partial<AppDeps>): AppDeps {
  return {
    createModelFactory: () => () => mockLanguageModel,
    authProviders: {},
    browserExecutor: new MockBrowserExecutor(),
    storage: new InMemoryStorage(),
    sessionStorage: new InMemorySessionStorage(),
    ...overrides,
  };
}
```

```typescript
// __tests__/orchestration/agent-loop.test.ts
const deps = createTestDeps({
  browserExecutor: mockBrowser,
});
await runAgentLoop({ deps, ... });
```

## 生成タイミングの一覧

| インスタンス                 | 生成タイミング            | ライフサイクル                          |
| ---------------------------- | ------------------------- | --------------------------------------- |
| `ChromeBrowserExecutor`      | main.tsx 初期化時         | サイドパネルの寿命と同じ                |
| `ChromeStorageAdapter`       | main.tsx 初期化時         | サイドパネルの寿命と同じ                |
| `IndexedDBSessionStorage`    | main.tsx 初期化時         | サイドパネルの寿命と同じ (DB接続はlazy) |
| `OpenAIAuth` / `CopilotAuth` | main.tsx 初期化時         | サイドパネルの寿命と同じ                |
| `VercelAIAdapter`            | agent-loop の各呼び出し時 | 1回の streamText ループ                 |
| `AutoSaver`                  | App.tsx の useMemo        | サイドパネルの寿命と同じ                |
| `AbortController`            | runAgentLoop 呼び出し時   | 1回のエージェントループ                 |

## 関連ドキュメント

- [パッケージ構成](../architecture/package-structure.md) - 依存ルール
- [agent-loop 詳細設計](./agent-loop-detail.md) - deps の使い方
- [テスト戦略](../architecture/testing.md) - モック差替え
