import { createArtifactKey, type StoredArtifactRecord } from "./artifact-record";

const DEFAULT_DB_NAME = "tandemweb";
const CURRENT_DB_VERSION = 4;
const SESSIONS_STORE = "sessions";
const METADATA_STORE = "sessions-metadata";
const LEGACY_TOOL_RESULTS_STORE = "tool-results";
const LAST_MODIFIED_INDEX = "lastModified";
const ARTIFACTS_STORE = "artifacts-v2";
const APP_META_STORE = "app-meta";
const ARTIFACTS_SESSION_ID_INDEX = "sessionId";
const ARTIFACTS_SESSION_UPDATED_AT_INDEX = "sessionId_updatedAt";
const LEGACY_JSON_ARTIFACTS_STORE = "json-artifacts";
const LEGACY_FILES_STORE = "files";
const ARTIFACTS_MIGRATION_DONE_KEY = "artifacts-migration-v1-done";
const MIGRATION_NOTES_KEY = "migration-notes";

type LegacyJsonArtifactRecord = {
  name: string;
  data: unknown;
  createdAt?: number;
  updatedAt?: number;
  visible?: boolean;
  sessionId?: string | null;
};

type LegacyFileArtifactRecord = {
  name: string;
  contentBase64: string;
  mimeType: string;
  size?: number;
  createdAt?: number;
  updatedAt?: number;
  visible?: boolean;
  sessionId?: string | null;
};

type MigrationNote = {
  name: string;
  losingKind: "json" | "file";
  timestamp: number;
};

export {
  APP_META_STORE,
  ARTIFACTS_MIGRATION_DONE_KEY,
  ARTIFACTS_SESSION_ID_INDEX,
  ARTIFACTS_SESSION_UPDATED_AT_INDEX,
  ARTIFACTS_STORE,
  CURRENT_DB_VERSION,
  DEFAULT_DB_NAME,
  LAST_MODIFIED_INDEX,
  METADATA_STORE,
  MIGRATION_NOTES_KEY,
  SESSIONS_STORE,
};

export function upgradeTandemwebDatabase(
  db: IDBDatabase,
  oldVersion: number,
  tx?: IDBTransaction,
): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
    }

    if (!db.objectStoreNames.contains(METADATA_STORE)) {
      const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: "id" });
      metadataStore.createIndex(LAST_MODIFIED_INDEX, LAST_MODIFIED_INDEX);
    }
  }

  if (oldVersion < 3 && db.objectStoreNames.contains(LEGACY_TOOL_RESULTS_STORE)) {
    db.deleteObjectStore(LEGACY_TOOL_RESULTS_STORE);
  }

  if (oldVersion < 4) {
    const upgradeTx = tx;
    if (!upgradeTx) {
      throw new Error("IndexedDB upgrade transaction is required for artifact schema migration");
    }
    const artifactsStore = ensureArtifactsStore(db, upgradeTx);
    const appMetaStore = ensureAppMetaStore(db, upgradeTx);
    migrateLegacyArtifacts(db, oldVersion, artifactsStore, appMetaStore);
  }
}

function ensureArtifactsStore(db: IDBDatabase, tx: IDBTransaction): IDBObjectStore {
  if (db.objectStoreNames.contains(ARTIFACTS_STORE)) {
    return tx.objectStore(ARTIFACTS_STORE);
  }

  const store = db.createObjectStore(ARTIFACTS_STORE, { keyPath: "key" });
  store.createIndex(ARTIFACTS_SESSION_ID_INDEX, ARTIFACTS_SESSION_ID_INDEX, { unique: false });
  store.createIndex(ARTIFACTS_SESSION_UPDATED_AT_INDEX, ["sessionId", "updatedAt"], {
    unique: false,
  });
  return store;
}

function ensureAppMetaStore(db: IDBDatabase, tx: IDBTransaction): IDBObjectStore {
  if (db.objectStoreNames.contains(APP_META_STORE)) {
    return tx.objectStore(APP_META_STORE);
  }

  return db.createObjectStore(APP_META_STORE, { keyPath: "key" });
}

function migrateLegacyArtifacts(
  db: IDBDatabase,
  oldVersion: number,
  artifactsStore: IDBObjectStore,
  appMetaStore: IDBObjectStore,
): void {
  if (oldVersion >= 4) {
    return;
  }

  const collisions: MigrationNote[] = [];
  const migratedKeys = new Set<string>();

  const migrateFiles = () => {
    if (!db.objectStoreNames.contains(LEGACY_FILES_STORE)) {
      finalizeMigration();
      return;
    }

    const legacyFileStore = appMetaStore.transaction.objectStore(LEGACY_FILES_STORE);
    const request = legacyFileStore.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        finalizeMigration();
        return;
      }

      const legacy = cursor.value as LegacyFileArtifactRecord;
      const record = toUnifiedFileRecord(legacy);
      if (migratedKeys.has(record.key)) {
        collisions.push({ name: legacy.name, losingKind: "json", timestamp: Date.now() });
      }
      artifactsStore.put(record);
      migratedKeys.add(record.key);
      cursor.continue();
    };
  };

  const migrateJson = () => {
    if (!db.objectStoreNames.contains(LEGACY_JSON_ARTIFACTS_STORE)) {
      migrateFiles();
      return;
    }

    const legacyJsonStore = appMetaStore.transaction.objectStore(LEGACY_JSON_ARTIFACTS_STORE);
    const request = legacyJsonStore.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        migrateFiles();
        return;
      }

      const legacy = cursor.value as LegacyJsonArtifactRecord;
      const record = toUnifiedJsonRecord(legacy);
      artifactsStore.put(record);
      migratedKeys.add(record.key);
      cursor.continue();
    };
  };

  const finalizeMigration = () => {
    appMetaStore.put({ key: ARTIFACTS_MIGRATION_DONE_KEY, value: true, updatedAt: Date.now() });
    appMetaStore.put({ key: MIGRATION_NOTES_KEY, value: collisions, updatedAt: Date.now() });

    if (db.objectStoreNames.contains(LEGACY_JSON_ARTIFACTS_STORE)) {
      db.deleteObjectStore(LEGACY_JSON_ARTIFACTS_STORE);
    }
    if (db.objectStoreNames.contains(LEGACY_FILES_STORE)) {
      db.deleteObjectStore(LEGACY_FILES_STORE);
    }
  };

  migrateJson();
}

function toUnifiedJsonRecord(legacy: LegacyJsonArtifactRecord): StoredArtifactRecord {
  const now = Date.now();
  const sessionId = legacy.sessionId ?? null;
  const encoded = new TextEncoder().encode(JSON.stringify(legacy.data));
  return {
    key: createArtifactKey(sessionId, legacy.name),
    sessionId,
    name: legacy.name,
    kind: "json",
    data: legacy.data,
    size: encoded.byteLength,
    visible: legacy.visible ?? true,
    createdAt: legacy.createdAt ?? now,
    updatedAt: legacy.updatedAt ?? legacy.createdAt ?? now,
  };
}

function toUnifiedFileRecord(legacy: LegacyFileArtifactRecord): StoredArtifactRecord {
  const now = Date.now();
  const sessionId = legacy.sessionId ?? null;
  const bytes = base64ToBytes(legacy.contentBase64);
  return {
    key: createArtifactKey(sessionId, legacy.name),
    sessionId,
    name: legacy.name,
    kind: "file",
    bytes,
    mimeType: legacy.mimeType,
    size: legacy.size ?? bytes.byteLength,
    visible: legacy.visible ?? true,
    createdAt: legacy.createdAt ?? now,
    updatedAt: legacy.updatedAt ?? legacy.createdAt ?? now,
  };
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(base64, "base64"));
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
      upgradeTandemwebDatabase(req.result, event.oldVersion, req.transaction ?? undefined);
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
