# データフロー設計

## 概要

ユーザー入力から最終的な画面表示までの一気通貫のデータフローを定義する。

## 全体フロー図

```
                   Side Panel                                    Background         Page
                   ─────────                                    ──────────         ────
User ──→ InputArea
           │
           ▼
         ChatSlice.addMessage(user)
         HistorySlice.pushHistory(user)
           │
           ▼
         orchestration/agent-loop
           │
           ├── resolveAIProvider(settings, deps)
           │     ├── AuthProvider.isValid() / refresh()
           │     └── createModelFactory() → VercelAIAdapter
           │
           ├── compressIfNeeded(session)  ←── 必要時のみ
           │
           ├── buildMessagesForAPI(session)
           │     └── [summary?] + history
           │
           ▼
         AIProvider.streamText({ model, systemPrompt, messages, tools })
           │
           │  AsyncIterable<StreamEvent>
           │
           ├─ text-delta ──→ ChatSlice.appendDelta(text)
           │                   → MessageBubble 再レンダリング (リアルタイム)
           │
           ├─ tool-call ──→ ChatSlice.addToolCall({ name, args, isRunning })
           │    │              → ToolCallBlock 表示 (Loader)
           │    │
           │    ▼
           │  features/tools で定義を参照
           │    │
           │    ▼
           │  BrowserExecutor (Port)
           │    │
           │    ▼                                chrome.runtime
           │  adapters/chrome/ ──────────────→ background/index.ts ──→ handlers/*
           │                                      │                       │
           │                                      │  chrome.scripting      │
           │                                      │  .executeScript()      │
           │                                      ▼                       ▼
           │                                    Content Script ←────→ Page DOM
           │                                      │
           │                   ←──────────────────┘ (sendResponse)
           │    │
           │    ▼
           │  ChatSlice.updateToolCallResult(result)
           │    → ToolCallBlock 更新 (✅/❌)
           │
           │  HistorySlice.pushHistory(toolResult)
           │    → 次の streamText ループへ
           │
           ├─ finish ──→ ChatSlice.finishStreaming()
           │              → StreamingIndicator 消去
           │              → autoSaver.saveImmediately()
           │
           └─ error ──→ ChatSlice.addErrorMessage(error)
                         → エラーバブル表示
```

## データ変換の流れ

```
ユーザー入力 (string)
  ↓
ChatMessage { role: "user", content: string }          ← UI表示用
AIMessage { role: "user", content: [{ type: "text" }]} ← API送信用
  ↓
streamText に渡す messages: AIMessage[]
  ↓ (summary があれば先頭に挿入)
AIProvider.streamText()
  ↓
StreamEvent (Port の型)
  ↓ toStreamEvent() で変換
Vercel AI SDK の fullStream (Adapter内部)
  ↓
text-delta → string → ChatSlice.appendDelta
  ↓
ChatMessage { role: "assistant", content: "..." }      ← 逐次更新
AssistantMessage { role: "assistant", content: [...] }  ← finish 後に確定

tool-call → ToolCallInfo → ChatSlice + execute
  ↓
BrowserExecutor メソッド → BackgroundRequest (shared/message-types)
  ↓
Background handler → chrome.scripting → Content Script → DOM
  ↓
BackgroundResponse → Result<T, Error>
  ↓
ToolResultMessage → HistorySlice → 次の streamText ループ
```

## 状態の流れ

### 書き込み元 → 読み取り先

```
InputArea         → ChatSlice.addMessage       → ChatArea (MessageBubble)
agent-loop        → ChatSlice.appendDelta      → ChatArea (ストリーミング)
agent-loop        → ChatSlice.addToolCall      → ChatArea (ToolCallBlock)
agent-loop        → ChatSlice.updateToolResult → ChatArea (ToolCallBlock)
agent-loop        → ChatSlice.finishStreaming   → InputArea (送信ボタン有効化)
agent-loop        → HistorySlice.pushHistory   → (次の streamText で使用)
autoSaver         → SessionStoragePort.save    → IndexedDB
SessionDropdown   → SessionSlice.switchSession → ChatSlice (履歴復元)
SettingsPanel     → SettingsSlice.setProvider  → agent-loop (プロバイダー変更)
chrome.tabs event → UISlice.setTab             → TabBar
```

## エラーの流れ

```
AIProvider.streamText()
  └─ StreamEvent { type: "error", error: AIError }
       → ChatSlice.addErrorMessage() → MessageBubble (role: "error")

AuthProvider.refresh()
  └─ Result.err(AuthError)
       → code: "auth_expired" → ChatSlice.addErrorMessage("再ログインしてください")
       → SettingsSlice.clearCredentials()

BrowserExecutor.*()
  └─ Result.err(BrowserError | ToolError)
       → agent-loop が ToolResultMessage.isError=true で AI に通知
       → AI が別のアプローチを試みる or ユーザーに報告
```

## NavigationMessage の変換フロー

```
chrome.tabs.onUpdated (タブ変更検知)
  │
  ├─ 常に → UISlice.setTab() → TabBar 更新
  │
  └─ ストリーミング中のみ
       → ChatSlice.addNavigationMessage({ url, title })
       → ChatArea に NavigationMessage 表示 (🌐 favicon + title)
       │
       └─ agent-loop が次の streamText 呼出し時:
            convertNavigationForAPI(nav)
              → AIMessage { role: "user", content: "[ページ遷移] title\nURL: url" }
```

**ChatMessage (role: "navigation") は UI表示専用。AI には user メッセージとして変換して送る。**

## 関連ドキュメント

- [agent-loop 詳細設計](./agent-loop-detail.md) - ループの内部フロー
- [AI Provider 詳細設計](./ai-provider-detail.md) - StreamEvent の型
- [ツール設計](../architecture/tools.md) - BrowserExecutor の実行フロー
- [エラーハンドリング](../architecture/error-handling.md) - エラー型と伝搬
