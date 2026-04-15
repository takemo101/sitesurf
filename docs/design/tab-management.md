# タブ管理機能設計書

## 概要

既存拡張 の `navigate` ツールの拡張機能を移植する：

- `listTabs`: 開いているタブの一覧取得
- `switchToTab`: 特定のタブに切り替え
- `newTab`: 新しいタブで URL を開く

## パラメータ拡張

```typescript
// 現在
interface NavigateArgs {
  url: string;
}

// 拡張後（既存拡張互換）
interface NavigateArgs {
  url?: string;
  newTab?: boolean;
  listTabs?: boolean;
  switchToTab?: number;
}
```

**注意**: `url` はオプショナルになる（`listTabs` や `switchToTab` 時は不要）。

## アクション別実装

### 1. `listTabs`

```typescript
async function listTabs(): Promise<ListTabsResult> {
  const tabs = await chrome.tabs.query({});
  return {
    tabs: tabs.map((t) => ({
      id: t.id!,
      url: t.url || "",
      title: t.title || "Untitled",
      active: t.active || false,
      favicon: t.favIconUrl,
    })),
  };
}
```

### 2. `switchToTab`

```typescript
async function switchToTab(tabId: number): Promise<SwitchTabResult> {
  // タブの存在確認
  const tab = await chrome.tabs.get(tabId);
  if (!tab) {
    throw new Error(`Tab ${tabId} not found`);
  }

  // タブをアクティブに
  await chrome.tabs.update(tabId, { active: true });

  // ウィンドウをフォーカス
  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  return {
    finalUrl: tab.url || "",
    title: tab.title || "Untitled",
    favicon: tab.favIconUrl,
    tabId,
    switchedToTab: tabId,
  };
}
```

### 3. `newTab`（URL指定時）

```typescript
async function openInNewTab(url: string): Promise<NavigateSuccessResult> {
  const newTab = await chrome.tabs.create({ url, active: true });
  if (!newTab.id) {
    throw new Error("Failed to create new tab");
  }

  // DOMContentLoaded を待つ
  await waitForDOMContentLoaded(newTab.id);

  const tab = await chrome.tabs.get(newTab.id);
  return {
    finalUrl: tab.url || url,
    title: tab.title || "Untitled",
    favicon: tab.favIconUrl,
    tabId: newTab.id,
  };
}

// DOMContentLoaded 待機
function waitForDOMContentLoaded(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0) {
        chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
        resolve();
      }
    };
    chrome.webNavigation.onDOMContentLoaded.addListener(listener);

    // タイムアウト
    setTimeout(() => {
      chrome.webNavigation.onDOMContentLoaded.removeListener(listener);
      resolve();
    }, 30000);
  });
}
```

## 実装ファイル

### `src/features/tools/navigate.ts`（修正）

```typescript
// 結果型の定義（Union型で区別）
export type NavigateResult = NavigateSuccessResult | ListTabsResult | SwitchTabResult;

export interface NavigateSuccessResult {
  finalUrl: string;
  title: string;
  favicon?: string;
  tabId: number;
  // listTabs, switchToTab にはないフィールド
}

export interface ListTabsResult {
  tabs: TabInfo[];
}

export interface SwitchTabResult {
  finalUrl: string;
  title: string;
  favicon?: string;
  tabId: number;
  switchedToTab: number;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
  favicon?: string;
}

// Tool定義
export const navigateToolDef: ToolDefinition = {
  name: "navigate",
  description: `URLに移動する、またはタブを管理します。

## アクション

### 通常のナビゲーション
- url: 移動先のURL（https:// を含む完全なURL）
- newTab: true の場合、新しいタブで開く（デフォルト: false）

### タブ管理
- listTabs: true の場合、開いているタブの一覧を返す
- switchToTab: 指定したタブIDに切り替える（listTabsで取得したIDを使用）

## 使用例

// 通常のナビゲーション
{ "url": "https://example.com" }

// 新しいタブで開く
{ "url": "https://example.com", "newTab": true }

// タブ一覧を取得
{ "listTabs": true }

// タブに切り替え
{ "switchToTab": 12345 }`,
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "移動先のURL（https:// を含む完全なURL）",
      },
      newTab: {
        type: "boolean",
        description: "trueの場合、新しいタブで開く",
      },
      listTabs: {
        type: "boolean",
        description: "trueの場合、タブ一覧を返す",
      },
      switchToTab: {
        type: "number",
        description: "切り替え先のタブID",
      },
    },
    // requiredは指定しない（アクションによる）
  },
};

export async function executeNavigate(
  browser: BrowserExecutor,
  args: NavigateArgs,
): Promise<Result<NavigateResult, ToolError | BrowserError>> {
  // listTabs
  if (args.listTabs) {
    return listTabs();
  }

  // switchToTab
  if (args.switchToTab !== undefined) {
    return switchToTab(args.switchToTab);
  }

  // 通常のナビゲーション
  if (args.url) {
    if (args.newTab) {
      return openInNewTab(args.url);
    }
    return navigateInCurrentTab(args.url);
  }

  return err({
    code: "tool_invalid_args",
    message: "無効な引数です。url、listTabs、またはswitchToTabを指定してください。",
  });
}

async function navigateInCurrentTab(
  url: string,
): Promise<Result<NavigateSuccessResult, BrowserError>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return err({ code: "browser_navigation_timeout", message: "アクティブなタブがありません" });
  }

  try {
    await chrome.tabs.update(tab.id, { url });
    await waitForDOMContentLoaded(tab.id);
    const updatedTab = await chrome.tabs.get(tab.id);
    return ok({
      finalUrl: updatedTab.url || url,
      title: updatedTab.title || "Untitled",
      favicon: updatedTab.favIconUrl,
      tabId: tab.id,
    });
  } catch (e) {
    return err({
      code: "browser_navigation_timeout",
      message: (e as Error).message,
    });
  }
}
```

## エラーハンドリング

| エラー                     | 原因                         | 対応                            |
| -------------------------- | ---------------------------- | ------------------------------- |
| タブが見つからない         | switchToTab で無効なID       | `Tab {id} not found`            |
| アクティブタブなし         | 現在のウィンドウにタブがない | `アクティブなタブがありません`  |
| ナビゲーションタイムアウト | ページ読み込みが30秒以上     | タイムアウトして現在のURLを返す |
| 新規タブ作成失敗           | ブラウザ制限等               | `Failed to create new tab`      |

## 既存機能との互換性

| 呼び出し                           | 動作                                         |
| ---------------------------------- | -------------------------------------------- |
| `{ "url": "..." }`                 | 現在のタブでナビゲーション（**互換性維持**） |
| `{ "url": "...", "newTab": true }` | 新しいタブで開く                             |
| `{ "listTabs": true }`             | タブ一覧を返す                               |
| `{ "switchToTab": 123 }`           | 指定タブに切り替え                           |

**重要**: `url` のみ指定された場合の動作は変更なし（後方互換性）。
