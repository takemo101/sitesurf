const DEFAULT_DB_NAME = "tandemweb";
const CURRENT_DB_VERSION = 3;
const SESSIONS_STORE = "sessions";
const METADATA_STORE = "sessions-metadata";
const LEGACY_TOOL_RESULTS_STORE = "tool-results";
const LAST_MODIFIED_INDEX = "lastModified";

export {
  CURRENT_DB_VERSION,
  DEFAULT_DB_NAME,
  LAST_MODIFIED_INDEX,
  METADATA_STORE,
  SESSIONS_STORE,
};

export function upgradeTandemwebDatabase(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
    }

    if (!db.objectStoreNames.contains(METADATA_STORE)) {
      const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: "id" });
      metadataStore.createIndex(LAST_MODIFIED_INDEX, LAST_MODIFIED_INDEX);
    }
  }

  // v2 で追加された tool-results ストアは v3 で廃止。LLM 要約 (auto-compact) に
  // 置き換えたためストア自体が不要になったので、既存ユーザのデータごと drop する。
  if (oldVersion < 3 && db.objectStoreNames.contains(LEGACY_TOOL_RESULTS_STORE)) {
    db.deleteObjectStore(LEGACY_TOOL_RESULTS_STORE);
  }
}

export function openTandemwebDatabase(options?: {
  dbName?: string;
  onSuccess?: (db: IDBDatabase) => void;
  onError?: (error: unknown) => void;
}): Promise<IDBDatabase> {
  const dbName = options?.dbName ?? DEFAULT_DB_NAME;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, CURRENT_DB_VERSION);

    req.onupgradeneeded = (event) => {
      upgradeTandemwebDatabase(req.result, event.oldVersion);
    };

    req.onsuccess = () => {
      const db = req.result;
      options?.onSuccess?.(db);
      resolve(db);
    };

    req.onerror = () => {
      const error = req.error;
      options?.onError?.(error);
      reject(error);
    };
  });
}
