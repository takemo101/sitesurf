# サイドパネル起動シーケンス設計

## 概要

`sidepanel/main.tsx` から始まる初期化フローを定める。
DI生成 → 設定読込 → セッション復元 → ロック取得 → UI表示の一連のシーケンス。

## 起動シーケンス全体図

```
main.tsx
  │
  │ (1) Adapter 生成 (同期)
  │     ChromeBrowserExecutor, ChromeStorageAdapter,
  │     IndexedDBSessionStorage, AuthProviders
  │
  │ (2) Background 接続 (セッションロック用)
  │     chrome.runtime.connect({ name: `sidepanel:${windowId}` })
  │
  │ (3) React マウント (DepsProvider + MantineProvider + ModalsProvider)
  │
  └──→ App.tsx (useEffect で非同期初期化)
        │
        │ (4) テーマ復元
        │     storage.get("tandemweb_theme") → setColorScheme
        │
        │ (5) 設定読込
        │     persistence.loadSettings(storage)
        │       → SettingsSlice に反映
        │
        │ (6) 設定チェック
        │     APIキー or OAuth credentials があるか？
        │       ├─ NO  → settingsOpen = true (設定パネル自動オープン)
        │       └─ YES → (7) へ
        │
        │ (7) セッション復元
        │     sessionStorage.getLatestSessionId()
        │       ├─ ID あり → acquireLock(id, windowId)
        │       │              ├─ ロック成功 → sessionStorage.getSession(id)
        │       │              │               → ChatSlice に messages/history ロード
        │       │              │               → SessionSlice.activeSessionId = id
        │       │              └─ ロック失敗 → (8) へ
        │       └─ ID なし → (8) へ
        │
        │ (8) 新規セッション作成
        │     SessionSlice.createSession(model)
        │     → acquireLock(newId, windowId)
        │     → WelcomeScreen 表示 (user/assistant メッセージなし)
        │
        │ (9) initialized = true → メインUI表示
        │
        │ (10) タブ追跡リスナー登録
        │      chrome.tabs.onActivated, chrome.tabs.onUpdated
```

## 各ステップの詳細

### (1) Adapter 生成

```typescript
// sidepanel/main.tsx

(async () => {
  // 同期的に生成可能なAdapter
  const browserExecutor = new ChromeBrowserExecutor();
  const storage = new ChromeStorageAdapter();
  const sessionStorage = new IndexedDBSessionStorage();  // DB接続は lazy

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

  // (2) Background 接続
  const windowId = (await chrome.windows.getCurrent()).id!;
  chrome.runtime.connect({ name: `sidepanel:${windowId}` });

  // (3) React マウント
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <DepsProvider value={deps}>
      <MantineProvider defaultColorScheme="auto" theme={mantineTheme}>
        <ModalsProvider>
          <Notifications position="top-right" />
          <App windowId={windowId} />
        </ModalsProvider>
      </MantineProvider>
    </DepsProvider>
  );
})();
```

### (4)-(9) App の非同期初期化

```typescript
// sidepanel/App.tsx

function App({ windowId }: { windowId: number }) {
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const deps = useDeps();

  useEffect(() => {
    initializeApp(deps, windowId)
      .then(() => setInitialized(true))
      .catch((err) => setInitError(err.message));
  }, []);

  if (initError) {
    return <InitErrorScreen error={initError} onRetry={() => location.reload()} />;
  }
  if (!initialized) {
    return <LoadingScreen />;
  }
  return <MainLayout />;
}
```

```typescript
// sidepanel/initialize.ts

export async function initializeApp(deps: AppDeps, windowId: number): Promise<void> {
  const { storage, sessionStorage } = deps;

  // (4) テーマ復元
  const savedTheme = await storage.get<string>("tandemweb_theme");
  if (savedTheme) {
    // MantineProvider の colorScheme を更新
    // ※ 実際にはuseStoreのUISliceにテーマを保持し、MantineProviderに渡す
    useStore.getState().setTheme(savedTheme as "auto" | "light" | "dark");
  }

  // (5) 設定読込
  const settings = await loadSettings(storage);
  if (settings) {
    useStore.getState().setSettings(settings);
  }

  // (6) 設定チェック
  const currentSettings = useStore.getState().settings;
  const hasAuth =
    currentSettings.apiKey || currentSettings.credentials || currentSettings.provider === "local";
  if (!hasAuth) {
    useStore.getState().setSettingsOpen(true);
    // セッション復元はスキップ、新規セッションを作成
    await createNewSession(deps, currentSettings, windowId);
    return;
  }

  // (7) セッション復元
  const latestId = await sessionStorage.getLatestSessionId();
  if (latestId) {
    const lockResult = await acquireSessionLock(latestId, windowId);
    if (lockResult.success) {
      const session = await sessionStorage.getSession(latestId);
      if (session) {
        useStore.getState().loadSession(session);
        useStore.getState().setActiveSessionId(latestId);
        return; // 復元成功
      }
    }
    // ロック失敗 or セッション読込失敗 → 新規作成
  }

  // (8) 新規セッション作成
  await createNewSession(deps, currentSettings, windowId);
}

async function createNewSession(
  deps: AppDeps,
  settings: Settings,
  windowId: number,
): Promise<void> {
  const id = crypto.randomUUID();
  const model = settings.model || PROVIDERS[settings.provider].defaultModel;
  const session: Session = {
    id,
    title: "",
    createdAt: new Date().toISOString(),
    model,
    messages: [],
    history: [],
  };
  useStore.getState().setActiveSession(session);
  await acquireSessionLock(id, windowId);
}

async function acquireSessionLock(
  sessionId: string,
  windowId: number,
): Promise<{ success: boolean }> {
  return chrome.runtime.sendMessage({
    type: "acquire-session-lock",
    sessionId,
    windowId,
  });
}
```

### (10) タブ追跡リスナー

```typescript
// sidepanel/App.tsx (useEffect 内)

useEffect(() => {
  if (!initialized) return;

  // 初回タブ情報取得
  updateTab();

  const onActivated = (info: chrome.tabs.TabActiveInfo) => {
    // 自ウィンドウのみ
    chrome.tabs.get(info.tabId).then((tab) => {
      if (tab.windowId === windowId) {
        updateTab();
        // ストリーミング中ならナビゲーションメッセージ挿入
        if (useStore.getState().isStreaming && tab.url && !tab.url.startsWith("chrome")) {
          useStore.getState().addNavigationMessage({ url: tab.url, title: tab.title || "" });
        }
      }
    });
  };

  const onUpdated = (_tabId: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (info.url && tab.active && tab.windowId === windowId) {
      updateTab();
      if (useStore.getState().isStreaming && !tab.url?.startsWith("chrome")) {
        useStore.getState().addNavigationMessage({ url: tab.url!, title: tab.title || "" });
      }
    }
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  return () => {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  };
}, [initialized, windowId]);
```

## 初期化失敗時のフォールバック

| ステップ                   | 失敗原因                 | フォールバック                          |
| -------------------------- | ------------------------ | --------------------------------------- |
| (1) Adapter 生成           | chrome.\* API が利用不可 | 発生しない (サイドパネルコンテキスト)   |
| (2) Background 接続        | Service Worker 未起動    | Chrome が自動起動するため通常発生しない |
| (4) テーマ復元             | storage 読込失敗         | デフォルト (auto) のまま                |
| (5) 設定読込               | storage 読込失敗         | デフォルト設定のまま → 設定パネルを開く |
| (7) セッション復元: ロック | ロック失敗               | 新規セッション作成                      |
| (7) セッション復元: DB     | IndexedDB 読込失敗       | 新規セッション作成 + コンソール警告     |
| 全体                       | 予期しない例外           | `InitErrorScreen` 表示 + リロードボタン |

### InitErrorScreen

```tsx
function InitErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Stack align="center" justify="center" h="100vh" gap="md" p="xl">
      <AlertCircle size={32} color="var(--mantine-color-red-5)" />
      <Text size="sm" ta="center">
        初期化に失敗しました
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        {error}
      </Text>
      <Button size="xs" onClick={onRetry}>
        再読込
      </Button>
    </Stack>
  );
}
```

## 関連ドキュメント

- [DI/ワイヤリング](./di-wiring.md) - AppDeps, DepsProvider
- [状態管理設計](../architecture/state-management.md) - slice 初期化
- [セッション管理](./session-management-detail.md) - セッション復元・ロック
- [機能仕様 F-02](./feature-spec.md) - 初回セットアップフロー
