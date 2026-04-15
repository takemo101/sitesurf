# マルチタブ / マルチウィンドウ設計

## 概要

複数ウィンドウでサイドパネルを開いた場合の状態同期と競合制御を定める。

## スコープ

### v0.1 で対応するもの

| 機能               | 説明                                           |
| ------------------ | ---------------------------------------------- |
| セッションロック   | 同一セッションの同時編集防止                   |
| 独立セッション     | 各ウィンドウで別セッションを開ける             |
| アクティブタブ追跡 | 各パネルが自ウィンドウのアクティブタブのみ追跡 |

### v0.1 で対応しないもの

| 機能                             | 理由                                     |
| -------------------------------- | ---------------------------------------- |
| セッション一覧のリアルタイム同期 | 頻度が低い。一覧を開くたびに再取得で十分 |
| 設定変更のリアルタイム同期       | 設定変更は稀。パネル再起動で反映         |
| タブ間のドラッグ&ドロップ        | スコープ外                               |

## 状態の分類

### ウィンドウ固有 (同期不要)

| 状態                               | 理由                         |
| ---------------------------------- | ---------------------------- |
| ChatSlice (messages, history)      | アクティブセッションに紐づく |
| UISlice (settingsOpen, currentTab) | パネルのUI状態               |
| isStreaming                        | 各パネルの AI 呼び出し状態   |

### 共有 (競合制御が必要)

| 状態                 | ストレージ             | 制御方法                               |
| -------------------- | ---------------------- | -------------------------------------- |
| セッション本体       | IndexedDB              | セッションロック                       |
| セッションメタデータ | IndexedDB              | セッションロック                       |
| 設定                 | chrome.storage.local   | 最後の書き込みが勝ち (last-write-wins) |
| セッションロック     | chrome.storage.session | Background の排他制御                  |

## セッションロックの詳細

[セッション管理 詳細設計](./session-management-detail.md) で定義済み。ここでは補足。

### ウィンドウ識別

```
chrome.windows.getCurrent() → windowId
chrome.runtime.connect({ name: `sidepanel:${windowId}` })
```

各ウィンドウのサイドパネルは `windowId` で一意に識別される。

### ロック状態の確認タイミング

| タイミング           | 処理                                                    |
| -------------------- | ------------------------------------------------------- |
| パネル起動時         | 最新セッションの acquireLock                            |
| セッション切替時     | 新セッションの acquireLock + 旧セッションの releaseLock |
| セッション一覧表示時 | getSessionLocks で全ロック状態を取得 → 🔒 表示          |
| パネル閉じ時         | port.onDisconnect → 全ロック自動解放                    |
| ウィンドウ閉じ時     | chrome.windows.onRemoved → ロック解放                   |

### 競合時のユーザー体験

```
Window A: session "abc" を編集中

Window B: セッション一覧を表示
  → "abc" に 🔒 マーク + "別ウィンドウで使用中" ラベル
  → クリックしても開けない
  → 他のセッションは選択可能
  → [+新しい会話] で新規セッションは常に可能
```

## タブ追跡

各パネルは自ウィンドウのアクティブタブのみを追跡する。

```typescript
// sidepanel/App.tsx
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // 自ウィンドウのタブ変更のみ処理
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.windowId === currentWindowId) {
    uiStore.setTab({ tabId: tab.id, url: tab.url, title: tab.title });
  }
});
```

Window A のタブ変更が Window B のパネルに影響しない。

## IndexedDB の同時アクセス

IndexedDB はブラウザ内で共有される。複数パネルからの同時アクセスについて:

| 操作                       | 安全性                    | 理由                                 |
| -------------------------- | ------------------------- | ------------------------------------ |
| 異なるセッションの読み書き | ✅ 安全                   | キーが異なるため競合しない           |
| 同一セッションの読み書き   | ⚠️ セッションロックで防止 | ロックなしだとデータ上書き           |
| メタデータ一覧の読み取り   | ✅ 安全                   | 読み取り専用                         |
| セッション作成             | ✅ 安全                   | UUID でキーが一意                    |
| セッション削除             | ⚠️ 要注意                 | ロック中のセッションは削除不可にする |

### 削除時の保護

```typescript
// features/sessions/session-store.ts
async deleteSession(id: string): Promise<Result<void, AppError>> {
  // ロック中のセッションは削除不可
  const locks = await deps.browserExecutor.send({ type: "get-session-locks" });
  if (locks.data?.locks?.[id]) {
    return err({ code: "session_locked", message: "このセッションは別のウィンドウで使用中です" });
  }
  await deps.sessionStorage.deleteSession(id);
  return ok(undefined);
}
```

## 関連ドキュメント

- [セッション管理](./session-management-detail.md) - ロック実装の詳細
- [状態管理設計](../architecture/state-management.md) - slice構造
- [BrowserExecutor 詳細](./browser-executor-detail.md) - Background 通信
