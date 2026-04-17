const DEFAULT_DB_NAME = "tandemweb";
const CURRENT_DB_VERSION = 2;
const SESSIONS_STORE = "sessions";
const METADATA_STORE = "sessions-metadata";
const TOOL_RESULTS_STORE = "tool-results";
const LAST_MODIFIED_INDEX = "lastModified";
const TOOL_RESULTS_SESSION_INDEX = "sessionId";
const TOOL_RESULTS_SESSION_CREATED_INDEX = "sessionId_createdAt";

export {
  CURRENT_DB_VERSION,
  DEFAULT_DB_NAME,
  LAST_MODIFIED_INDEX,
  METADATA_STORE,
  SESSIONS_STORE,
  TOOL_RESULTS_SESSION_CREATED_INDEX,
  TOOL_RESULTS_SESSION_INDEX,
  TOOL_RESULTS_STORE,
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

  if (oldVersion < 2 && !db.objectStoreNames.contains(TOOL_RESULTS_STORE)) {
    const toolResultsStore = db.createObjectStore(TOOL_RESULTS_STORE, { keyPath: "key" });
    toolResultsStore.createIndex(TOOL_RESULTS_SESSION_INDEX, "sessionId", { unique: false });
    toolResultsStore.createIndex(TOOL_RESULTS_SESSION_CREATED_INDEX, ["sessionId", "createdAt"], {
      unique: false,
    });
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
