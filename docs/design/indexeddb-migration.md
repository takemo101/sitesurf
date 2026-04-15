# IndexedDB スキーママイグレーション設計

## 概要

IndexedDB のスキーマ変更時にデータを安全にマイグレーションする方針を定める。

## IndexedDB のバージョン管理

IndexedDB は `open(dbName, version)` の `version` でスキーマバージョンを管理する。
バージョンが上がると `onupgradeneeded` が発火し、そこでスキーマ変更を行う。

## 現行スキーマ (v1)

```typescript
const DB_NAME = "tandemweb";
const DB_VERSION = 1;

// onupgradeneeded
function upgrade(db: IDBDatabase, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore("sessions", { keyPath: "id" });
    const meta = db.createObjectStore("sessions-metadata", { keyPath: "id" });
    meta.createIndex("lastModified", "lastModified");
  }
}
```

## マイグレーション戦略

### 逐次適用方式

既存拡張 と同様に、バージョンごとの変更を逐次適用する。

```typescript
function upgrade(db: IDBDatabase, oldVersion: number, transaction: IDBTransaction) {
  // v0 → v1: 初期スキーマ
  if (oldVersion < 1) {
    db.createObjectStore("sessions", { keyPath: "id" });
    const meta = db.createObjectStore("sessions-metadata", { keyPath: "id" });
    meta.createIndex("lastModified", "lastModified");
  }

  // v1 → v2: (将来の例) settings ストアを追加
  if (oldVersion < 2) {
    db.createObjectStore("settings", { keyPath: "key" });
  }

  // v2 → v3: (将来の例) sessions に model インデックスを追加
  if (oldVersion < 3) {
    const sessionsMetaStore = transaction.objectStore("sessions-metadata");
    sessionsMetaStore.createIndex("modelId", "modelId");
  }
}
```

### データマイグレーション

スキーマ変更だけでなく、既存データの変換が必要な場合:

```typescript
// v3 → v4: Session.title フィールドの追加 (既存データに title がない)
if (oldVersion < 4) {
  // onupgradeneeded 内ではカーソルでデータを読み書きできる
  const store = transaction.objectStore("sessions");
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      const session = cursor.value;
      if (!session.title) {
        session.title = "無題のセッション";
        cursor.update(session);
      }
      cursor.continue();
    }
  };
}
```

## 既存拡張 の方式との比較

既存拡張 は `SessionsStore` のサブクラスでメッセージ形式のマイグレーションを行っている:

```typescript
// 既存拡張: 読み込み時に旧形式を変換
private migrateToolResultMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages.map((msg) => {
    if (msg.role === "toolResult" && "output" in msg && !msg.content) {
      const { output, ...rest } = msg;
      return { ...rest, content: [{ type: "text", text: output }] };
    }
    return msg;
  });
}
```

**TandemWeb では両方のアプローチを併用する:**

1. **スキーマ変更** (ObjectStore / Index の追加・削除): `onupgradeneeded` で逐次適用
2. **データ形式変更** (フィールドの追加・リネーム): 読み込み時に変換 (lazy migration)

### Lazy migration の利点

- 全データを一括変換しなくてよい (大量セッションがある場合に有利)
- onupgradeneeded はトランザクション内なので時間制約がある
- 読み込み時に変換すれば、古いデータも新しいデータも透過的に扱える

```typescript
// adapters/storage/indexeddb-session-storage.ts

async getSession(id: string): Promise<Session | null> {
  const raw = await this.getRaw(id);
  if (!raw) return null;
  return migrateSession(raw);  // 旧形式のデータを現行形式に変換
}

function migrateSession(raw: Record<string, unknown>): Session {
  // v1 → v2: title フィールドの追加
  if (!raw.title) {
    raw.title = "無題のセッション";
  }
  // v2 → v3: ... (将来)
  return raw as Session;
}
```

## バージョン管理ルール

1. **DB_VERSION は必ず整数でインクリメント** (1, 2, 3, ...)
2. **onupgradeneeded の各 if ブロックは消さない** (v1→v5 に直接アップグレードする場合、v2, v3, v4 のブロックも通る)
3. **本番リリース後のスキーマ変更は ADR として記録** (`docs/decisions/xxx-indexeddb-vN.md`)
4. **テストで全バージョンからの upgrade パスを検証** (v1→v3, v2→v3 等)

## 関連ドキュメント

- [セッション管理](./session-management-detail.md) - IndexedDB スキーマ
- [テスト戦略](../architecture/testing.md) - マイグレーションのテスト
