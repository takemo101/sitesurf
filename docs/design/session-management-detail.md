# セッション管理 詳細設計

## 概要

会話履歴を永続化し、複数セッションの切替、マルチウィンドウのロック制御、
長い会話のコンテキスト圧縮を実現する。

既存拡張 の設計を参考に、メタデータ分離・セッションロック・preview テキストを取り入れる。

## 要件

| 要件             | 内容                                                   |
| ---------------- | ------------------------------------------------------ |
| 永続化           | パネルを閉じても会話が残る。ブラウザ再起動後も復元     |
| 複数セッション   | セッション一覧から選んで切替。新規作成・削除           |
| メタデータ分離   | 一覧表示用の軽量メタデータと本体を分離 (既存拡張方式)  |
| セッションロック | 複数ウィンドウで同一セッションを同時編集しない         |
| preview          | 一覧での検索・識別用に先頭テキストを保持               |
| コンテキスト圧縮 | 会話が長くなったら古いメッセージを要約してトークン節約 |

## データモデル

### Session (本体 — 重量)

```typescript
export interface Session {
  id: string; // UUID v4
  title: string; // セッションタイトル
  createdAt: string; // ISO 8601 (作成時に設定し変更しない)
  model: string; // 使用モデルID
  messages: ChatMessage[]; // UI表示用
  history: AIMessage[]; // AI API送信用
  summary?: ConversationSummary; // 圧縮された過去のコンテキスト
}
```

### SessionMeta (メタデータ — 軽量)

```typescript
export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  lastModified: string; // ISO 8601
  messageCount: number;
  modelId: string;
  preview: string; // 先頭2KBのテキスト (検索・識別用)
}
```

### Session と SessionMeta の関係

**Session が正 (source of truth)。SessionMeta は Session から導出されるスナップショット。**

- `title`, `createdAt` は Session 本体が保持し、SessionMeta にコピーされる
- `lastModified`, `messageCount`, `preview` は保存時に Session から算出して SessionMeta に設定
- セッション読込時は Session 本体のみ使用し、メタデータは一覧表示のためだけに存在

### ConversationSummary

```typescript
export interface ConversationSummary {
  text: string;
  compressedAt: number; // Unix ms
  originalMessageCount: number;
}
```

### なぜ2ストア分離か

```
sessions-metadata (~1KB/件)          sessions (~100KB/件)
┌──────────────────────────┐       ┌───────────────────────────┐
│ id, title                │       │ id, title, createdAt      │
│ createdAt, lastModified  │       │ model                     │
│ messageCount, modelId    │       │ messages: ChatMessage[]   │
│ preview (2KB)            │       │ history: AIMessage[]      │
└──────────────────────────┘       │ summary                   │
                                    └───────────────────────────┘
```

| 操作               | 読むストア                                                           |
| ------------------ | -------------------------------------------------------------------- |
| セッション一覧表示 | metadata のみ (高速)                                                 |
| セッション検索     | metadata.preview でフィルタ。件数が多い場合は Fuse.js 等の導入を検討 |
| セッション切替     | sessions 本体を読込                                                  |
| 保存               | 両方にアトミック書込                                                 |

## ストレージ設計

### SessionStoragePort

```typescript
// ports/session-storage.ts

export interface SessionStoragePort {
  listSessions(): Promise<SessionMeta[]>;
  getMetadata(id: string): Promise<SessionMeta | null>;
  getLatestSessionId(): Promise<string | null>;
  getSession(id: string): Promise<Session | null>;
  saveSession(session: Session, meta: SessionMeta): Promise<void>;
  updateTitle(id: string, title: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
```

### IndexedDB Adapter

```typescript
// adapters/storage/indexeddb-session-storage.ts

const DB_NAME = "tandemweb";
const DB_VERSION = 1;

export class IndexedDBSessionStorage implements SessionStoragePort {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("sessions"))
          db.createObjectStore("sessions", { keyPath: "id" });
        if (!db.objectStoreNames.contains("sessions-metadata")) {
          const meta = db.createObjectStore("sessions-metadata", { keyPath: "id" });
          meta.createIndex("lastModified", "lastModified");
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async listSessions(): Promise<SessionMeta[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sessions-metadata", "readonly");
      const index = tx.objectStore("sessions-metadata").index("lastModified");
      const req = index.openCursor(null, "prev");
      const results: SessionMeta[] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getLatestSessionId(): Promise<string | null> {
    const list = await this.listSessions();
    return list[0]?.id ?? null;
  }

  async getSession(id: string): Promise<Session | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction("sessions", "readonly").objectStore("sessions").get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSession(session: Session, meta: SessionMeta): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "sessions-metadata"], "readwrite");
      tx.objectStore("sessions").put(session);
      tx.objectStore("sessions-metadata").put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateTitle(id: string, title: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "sessions-metadata"], "readwrite");
      // 本体側も更新 (Session が source of truth)
      const sessStore = tx.objectStore("sessions");
      const sessReq = sessStore.get(id);
      sessReq.onsuccess = () => {
        if (sessReq.result) sessStore.put({ ...sessReq.result, title });
      };
      // メタデータ側も更新
      const metaStore = tx.objectStore("sessions-metadata");
      const metaReq = metaStore.get(id);
      metaReq.onsuccess = () => {
        if (metaReq.result) metaStore.put({ ...metaReq.result, title });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "sessions-metadata"], "readwrite");
      tx.objectStore("sessions").delete(id);
      tx.objectStore("sessions-metadata").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMetadata(id: string): Promise<SessionMeta | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const req = db
        .transaction("sessions-metadata", "readonly")
        .objectStore("sessions-metadata")
        .get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }
}
```

## セッションロック

### 解決方式

既存拡張 と同方式。`chrome.storage.session` でロック状態を管理。

**既知の制約**: `chrome.storage.session` は compare-and-swap をサポートしないため、
2つのウィンドウが同時にロック取得を試みた場合に競合する可能性がある。
実用上はサイドパネルの起動タイミングが重なることは稀であり、許容する。

### メッセージプロトコル

```typescript
// shared/message-types.ts に追加

export type BackgroundRequest =
  | { type: "acquire-session-lock"; sessionId: string; windowId: number }
  | { type: "release-session-lock"; sessionId: string }
  | { type: "get-session-locks" };

export type SessionLockResponse = { success: true } | { success: false; ownerWindowId: number };
```

### Background のロック管理

```typescript
// background/handlers/session-lock.ts

export async function acquireLock(
  sessionId: string,
  windowId: number,
): Promise<SessionLockResponse> {
  const data = await chrome.storage.session.get(["session_locks", "open_panels"]);
  const locks: Record<string, number> = data.session_locks || {};
  const openPanels: number[] = data.open_panels || [];

  const owner = locks[sessionId];
  const ownerPanelOpen = owner !== undefined && openPanels.includes(owner);

  if (!owner || !ownerPanelOpen || owner === windowId) {
    locks[sessionId] = windowId;
    await chrome.storage.session.set({ session_locks: locks });
    return { success: true };
  }
  return { success: false, ownerWindowId: owner };
}
```

### パネル開閉の追跡

```typescript
// background/index.ts
chrome.runtime.onConnect.addListener((port) => {
  const match = /^sidepanel:(\d+)$/.exec(port.name);
  if (!match) return;
  const windowId = Number(match[1]);
  addOpenPanel(windowId);
  port.onDisconnect.addListener(() => {
    removeOpenPanel(windowId);
    releaseLocksForWindow(windowId);
  });
});
```

### セッション読込フロー

```
起動
  ├─ URLに ?session=xxx → acquireLock(xxx)
  │   ├─ 成功 → getSession(xxx) → 復元
  │   └─ 失敗 → 新規セッション
  └─ URLにセッション指定なし
      → getLatestSessionId() → acquireLock
        ├─ 成功 → 復元
        └─ 失敗 or なし → 新規セッション
```

## 状態管理: Source of Truth

### ChatSlice が正

**アクティブセッションの `messages` / `history` は ChatSlice が source of truth。**
Session オブジェクトは保存時のスナップショットであり、リアルタイムのデータは ChatSlice にある。

```
switchSession(id)
  → sessionStorage.getSession(id)
  → ChatSlice に messages / history をロード
  → SessionSlice.activeSessionId = id
  → SessionSlice.activeSessionSnapshot = session  (メタ情報保持用)

メッセージ追加
  → ChatSlice.addMessage()  (source of truth を更新)
  → autoSaver.scheduleSave()

保存時
  → ChatSlice から messages / history を読み取り
  → Session + SessionMeta を構築
  → sessionStorage.saveSession()
```

### SessionSlice

```typescript
export interface SessionSlice {
  sessionList: SessionMeta[]; // 一覧 (メタデータのみ)
  activeSessionId: string | null;
  activeSessionSnapshot: Session | null; // title, createdAt, model 等を保持

  loadSessionList(): Promise<void>;
  createSession(model: string): Promise<string>;
  switchSession(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  renameSession(id: string, title: string): Promise<void>;
}
```

## セッション保存

### 保存内容の組み立て

```typescript
// features/sessions/save-builder.ts

/**
 * ChatSlice から Session + SessionMeta を構築する。
 * sessionStorage は引数で受け取る (Port 経由)。
 */
export function buildSaveData(
  snapshot: Session, // activeSessionSnapshot
  chatSlice: ChatSlice, // source of truth
): { session: Session; meta: SessionMeta } {
  const now = new Date().toISOString();

  const session: Session = {
    ...snapshot,
    messages: chatSlice.messages,
    history: chatSlice.history,
  };

  let preview = "";
  for (const msg of chatSlice.messages) {
    if (preview.length >= 2048) break;
    if (msg.role === "user" || msg.role === "assistant") {
      preview += msg.content + "\n";
    }
  }

  const meta: SessionMeta = {
    id: snapshot.id,
    title: snapshot.title,
    createdAt: snapshot.createdAt,
    lastModified: now,
    messageCount: chatSlice.messages.length,
    modelId: snapshot.model,
    preview: preview.substring(0, 2048),
  };

  return { session, meta };
}
```

`buildSaveData` は純粋な関数。外部依存なし。`sessionStorage` への書き込みは呼び出し側が行う。

### 自動保存

```typescript
// features/sessions/auto-save.ts

export function createAutoSaver(
  sessionStorage: SessionStoragePort,
  getState: () => {
    activeSessionSnapshot: Session | null;
    messages: ChatMessage[];
    history: AIMessage[];
  },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = async () => {
    const state = getState();
    if (!state.activeSessionSnapshot) return;
    const { session, meta } = buildSaveData(state.activeSessionSnapshot, state);
    await sessionStorage.saveSession(session, meta);
  };

  return {
    scheduleSave() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 2000);
    },
    async saveImmediately() {
      if (timer) clearTimeout(timer);
      await save();
    },
  };
}
```

`createAutoSaver` は `useStore.getState` を直接importせず、`getState` 関数を引数で受け取る。
テスト時にモック可能。

## セッションタイトル

| 方式            | 説明                                   |
| --------------- | -------------------------------------- |
| 自動生成 (v0.1) | 最初のユーザーメッセージから先頭50文字 |
| ユーザー編集    | SessionHeader でクリックしてリネーム   |

```typescript
function generateTitle(firstMessage: string): string {
  const text = firstMessage.replace(/\n/g, " ").trim();
  return text.length > 50 ? text.substring(0, 50) + "…" : text || "新しい会話";
}
```

## コンテキスト圧縮

### トリガー

```typescript
const COMPRESS_THRESHOLDS: Record<ProviderId, number> = {
  anthropic: 150_000,
  openai: 90_000,
  google: 700_000,
  copilot: 90_000,
  local: 5_000,
};
```

### 圧縮の設計方針

- **ユーザーの意図しないAPI課金のリスク**: 要約生成はAI API呼び出しを伴う。
  ローカルLLMでは無料だが、クラウドプロバイダーでは課金が発生する。
  **v0.1 ではローカルLLMのみ自動圧縮を有効にし、クラウドプロバイダーではユーザーに確認を取る。**

- **失敗時のフォールバック**: 要約生成が失敗（APIエラー、タイムアウト）した場合は
  **圧縮せずに元のセッションをそのまま返す**。データ損失は絶対に起こさない。

```typescript
// orchestration/context-compressor.ts

export async function compressIfNeeded(
  aiProvider: AIProvider,
  session: Session,
  model: string,
  provider: ProviderId,
  options: { userConfirmed?: boolean } = {},
): Promise<{ session: Session; compressed: boolean }> {
  const threshold = COMPRESS_THRESHOLDS[provider] ?? 90_000;
  const tokenCount = estimateTokens(session.history);
  if (tokenCount < threshold) return { session, compressed: false };

  // クラウドプロバイダーではユーザー確認が必要
  if (provider !== "local" && !options.userConfirmed) {
    return { session, compressed: false };
    // 呼び出し側が UI でユーザーに確認 → userConfirmed: true で再呼び出し
  }

  const keepRecent = 10;
  const toCompress = session.history.slice(0, -keepRecent);
  const toKeep = session.history.slice(-keepRecent);

  // フォールバック: 失敗したら元のセッションを返す
  try {
    const summaryText = await summarizeMessages(aiProvider, model, session.summary, toCompress);
    return {
      session: {
        ...session,
        summary: {
          text: summaryText,
          compressedAt: Date.now(),
          originalMessageCount: (session.summary?.originalMessageCount ?? 0) + toCompress.length,
        },
        history: toKeep,
        // messages (UI用) は全件保持
      },
      compressed: true,
    };
  } catch {
    // 要約生成に失敗 → 圧縮せず元のまま返す。データ損失なし
    return { session, compressed: false };
  }
}
```

### AI API に送るメッセージの組み立て

```typescript
function buildMessagesForAPI(session: Session): AIMessage[] {
  const messages: AIMessage[] = [];
  if (session.summary) {
    messages.push({
      role: "user",
      content: [{ type: "text", text: `[以前の会話の要約]\n${session.summary.text}` }],
    });
    messages.push({
      role: "assistant",
      content: [
        { type: "text", text: "理解しました。要約の内容を踏まえて引き続きお手伝いします。" },
      ],
    });
  }
  messages.push(...session.history);
  return messages;
}
```

### トークン数の推定

```typescript
/**
 * 簡易トークン推定。日英混在で 1文字 ≈ 1トークン の概算。
 *
 * 既知の不正確さ:
 * - 英語テキストは実際には 1文字 ≈ 0.25トークン → 過大評価
 * - 日本語テキストは 1文字 ≈ 1.5トークン → 過小評価
 * - 過大評価方向（英語テキスト多い場合）は不要な早期圧縮を引き起こす
 *
 * 将来: tiktoken-lite 等の軽量トークナイザーの導入を検討
 */
function estimateTokens(messages: AIMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const c of msg.content) {
        if ("text" in c && c.text) chars += c.text.length;
      }
    }
  }
  return chars;
}
```

## UI

### セッション一覧

```
┌──────────────────────────────────┐
│ [≡] TandemWeb       [+新規] [⚙] │
├──────────────────────────────────┤
│ 📝 現在のページを分析して...  ▼   │  ← クリックで一覧
├──────────────────────────────────┤
│ (チャットエリア)                  │
```

ドロップダウン:

```
┌──────────────────────────────────┐
│ 🔍 セッション検索...              │
├──────────────────────────────────┤
│ 📝 現在のページを分析して...  🗑  │
│    3分前 · 12 messages            │
│ 📝 ECサイトの価格比較         🗑  │
│    1時間前 · 24 messages          │
│ 🔒 別ウィンドウで使用中           │
├──────────────────────────────────┤
│ [+ 新しい会話]                    │
└──────────────────────────────────┘
```

### コンテキスト圧縮の UI

クラウドプロバイダーの場合、圧縮前にユーザー確認:

```
┌──────────────────────────────────┐
│ ⚠️ 会話が長くなっています。       │
│ 古いメッセージを要約して          │
│ コンテキストを圧縮しますか？      │
│ (AI API呼び出しが発生します)      │
│                                  │
│      [キャンセル]  [圧縮する]     │
└──────────────────────────────────┘
```

圧縮完了後:

```
│ ── 📦 過去の会話を要約しました ── │
```

## パッケージへの影響

```
src/
├── features/sessions/
│   ├── SessionHeader.tsx
│   ├── SessionList.tsx
│   ├── session-store.ts         # SessionSlice
│   ├── save-builder.ts          # buildSaveData (純粋関数)
│   ├── auto-save.ts             # createAutoSaver (DI対応)
│   └── types.ts                 # Session, SessionMeta
│
├── orchestration/
│   ├── agent-loop.ts            # [変更] セッション保存呼出し
│   └── context-compressor.ts    # [新規] フォールバック + ユーザー確認対応
│
├── ports/
│   ├── session-storage.ts       # [新規]
│   └── browser-executor.ts      # [変更] onTabRemoved 追加
│
├── adapters/storage/
│   └── indexeddb-session-storage.ts
│
├── background/
│   ├── index.ts                 # [変更] ポート管理
│   └── handlers/session-lock.ts
│
└── shared/message-types.ts      # [変更] ロックメッセージ型
```

## 関連ドキュメント

- [状態管理設計](../architecture/state-management.md) - Zustand slice構造
- [AI Provider 詳細設計](./ai-provider-detail.md) - streamText で要約生成
- [パッケージ構成](../architecture/package-structure.md)
- [エラーハンドリング](../architecture/error-handling.md)
