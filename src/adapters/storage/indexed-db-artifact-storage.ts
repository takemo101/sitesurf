import type {
  ArtifactKind,
  ArtifactMeta,
  ArtifactValue,
  UnifiedArtifactStoragePort,
} from "@/ports/artifact-storage";
import { createLogger } from "@/shared/logger";
import {
  ARTIFACTS_V2_STORE,
  DEFAULT_DB_NAME,
  MIGRATION_FLAGS_STORE,
  MIGRATION_NOTES_STORE,
  SESSION_ID_INDEX,
  openTandemwebDatabase,
} from "./indexeddb-database";

const log = createLogger("indexed-db-artifact-storage");

const MIGRATION_FLAG_KEY = "artifacts-migration-v1-done";

// IDB does not support null as an index key; use "" to represent no session.
const NULL_SESSION = "";

function sanitizeName(name: string): string {
  return name.replace(/[./\\:*?"<>|]/g, "_");
}

function makeKey(sessionId: string | null, name: string): string {
  return `${sessionId ?? NULL_SESSION}::${sanitizeName(name)}`;
}

interface ArtifactRecord {
  key: string;
  sessionId: string;
  name: string;
  kind: ArtifactKind;
  mimeType?: string;
  size: number;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
  jsonData?: unknown;
  fileBytes?: Uint8Array;
}

interface MigrationNote {
  name: string;
  losingKind: ArtifactKind;
  timestamp: number;
}

interface MigrationFlag {
  flag: string;
  timestamp: number;
}

export interface LegacyJsonArtifact {
  name: string;
  data: unknown;
  sessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LegacyFileArtifact {
  name: string;
  contentBase64: string;
  mimeType: string;
  size: number;
  sessionId: string | null;
  createdAt: number;
}

export interface LegacyArtifactReader {
  readLegacyJsonArtifacts(): Promise<LegacyJsonArtifact[]>;
  readLegacyFileArtifacts(): Promise<LegacyFileArtifact[]>;
  deleteLegacyArtifacts(): Promise<void>;
}

export class IndexedDBArtifactStorage implements UnifiedArtifactStoragePort {
  private db: IDBDatabase | null = null;
  private sessionId: string | null = null;

  constructor(
    private readonly dbName = DEFAULT_DB_NAME,
    private readonly legacyReader?: LegacyArtifactReader,
  ) {}

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    const db = await openTandemwebDatabase({
      dbName: this.dbName,
      onSuccess: (openedDb) => {
        this.db = openedDb;
      },
      onError: (error) => {
        log.error("IndexedDB open エラー", error);
      },
    });
    this.db = db;
    return db;
  }

  async initialize(): Promise<void> {
    const db = await this.getDB();
    if (this.legacyReader) {
      await runMigrationIfNeeded(db, this.legacyReader);
    }
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  async put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void> {
    const db = await this.getDB();
    const key = makeKey(this.sessionId, name);
    const now = Date.now();

    const existing = await getRecord(db, key);

    const record: ArtifactRecord = {
      key,
      sessionId: this.sessionId ?? NULL_SESSION,
      name,
      kind: value.kind,
      mimeType: value.kind === "file" ? value.mimeType : undefined,
      size: value.kind === "json" ? JSON.stringify(value.data).length : value.bytes.length,
      visible: options?.visible ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      jsonData: value.kind === "json" ? value.data : undefined,
      fileBytes: value.kind === "file" ? value.bytes : undefined,
    };

    await putRecord(db, record);
  }

  async get(name: string): Promise<ArtifactValue | null> {
    const db = await this.getDB();
    const key = makeKey(this.sessionId, name);
    const record = await getRecord(db, key);
    if (!record) return null;

    if (record.kind === "json") {
      return { kind: "json", data: record.jsonData };
    }

    return {
      kind: "file",
      bytes: record.fileBytes!,
      mimeType: record.mimeType!,
    };
  }

  async list(): Promise<ArtifactMeta[]> {
    const db = await this.getDB();
    return listBySession(db, this.sessionId);
  }

  async delete(name: string): Promise<void> {
    const db = await this.getDB();
    const key = makeKey(this.sessionId, name);
    await deleteRecord(db, key);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    const metas = await listBySession(db, this.sessionId);
    const keys = metas.map((m) => makeKey(this.sessionId, m.name));
    await deleteRecords(db, keys);
  }
}

function getRecord(db: IDBDatabase, key: string): Promise<ArtifactRecord | undefined> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(ARTIFACTS_V2_STORE, "readonly")
      .objectStore(ARTIFACTS_V2_STORE)
      .get(key);
    req.onsuccess = () => resolve(req.result as ArtifactRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

function putRecord(db: IDBDatabase, record: ArtifactRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARTIFACTS_V2_STORE, "readwrite");
    tx.objectStore(ARTIFACTS_V2_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function deleteRecord(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARTIFACTS_V2_STORE, "readwrite");
    tx.objectStore(ARTIFACTS_V2_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function deleteRecords(db: IDBDatabase, keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARTIFACTS_V2_STORE, "readwrite");
    const store = tx.objectStore(ARTIFACTS_V2_STORE);
    for (const key of keys) store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function listBySession(db: IDBDatabase, sessionId: string | null): Promise<ArtifactMeta[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARTIFACTS_V2_STORE, "readonly");
    const index = tx.objectStore(ARTIFACTS_V2_STORE).index(SESSION_ID_INDEX);
    const req = index.getAll(sessionId ?? NULL_SESSION);
    req.onsuccess = () => {
      const metas: ArtifactMeta[] = (req.result as ArtifactRecord[]).map((r) => ({
        name: r.name,
        kind: r.kind,
        mimeType: r.mimeType,
        size: r.size,
        visible: r.visible,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
      resolve(metas);
    };
    req.onerror = () => reject(req.error);
  });
}

function hasMigrationRun(db: IDBDatabase): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(MIGRATION_FLAGS_STORE, "readonly")
      .objectStore(MIGRATION_FLAGS_STORE)
      .get(MIGRATION_FLAG_KEY);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

function setMigrationFlag(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const flag: MigrationFlag = { flag: MIGRATION_FLAG_KEY, timestamp: Date.now() };
    const tx = db.transaction(MIGRATION_FLAGS_STORE, "readwrite");
    tx.objectStore(MIGRATION_FLAGS_STORE).put(flag);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function writeMigrationData(
  db: IDBDatabase,
  records: ArtifactRecord[],
  notes: MigrationNote[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ARTIFACTS_V2_STORE, MIGRATION_NOTES_STORE], "readwrite");
    const artifactStore = tx.objectStore(ARTIFACTS_V2_STORE);
    const notesStore = tx.objectStore(MIGRATION_NOTES_STORE);

    for (const record of records) {
      artifactStore.put(record);
    }
    for (const note of notes) {
      notesStore.put(note);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function runMigrationIfNeeded(
  db: IDBDatabase,
  reader: LegacyArtifactReader,
): Promise<void> {
  if (await hasMigrationRun(db)) return;

  const [jsonArtifacts, fileArtifacts] = await Promise.all([
    reader.readLegacyJsonArtifacts(),
    reader.readLegacyFileArtifacts(),
  ]);

  if (jsonArtifacts.length === 0 && fileArtifacts.length === 0) {
    await setMigrationFlag(db);
    return;
  }

  const notes: MigrationNote[] = [];
  const nameSet = new Set<string>();
  const records: ArtifactRecord[] = [];

  // File artifacts are added first — they win on name collision.
  for (const fa of fileArtifacts) {
    nameSet.add(fa.name);
    records.push({
      key: makeKey(fa.sessionId, fa.name),
      sessionId: fa.sessionId ?? NULL_SESSION,
      name: fa.name,
      kind: "file",
      mimeType: fa.mimeType,
      size: fa.size,
      visible: true,
      createdAt: fa.createdAt,
      updatedAt: fa.createdAt,
      fileBytes: base64ToUint8Array(fa.contentBase64),
    });
  }

  // JSON artifacts are skipped if a file with the same name already exists.
  for (const ja of jsonArtifacts) {
    if (nameSet.has(ja.name)) {
      notes.push({ name: ja.name, losingKind: "json", timestamp: Date.now() });
      continue;
    }
    nameSet.add(ja.name);
    records.push({
      key: makeKey(ja.sessionId, ja.name),
      sessionId: ja.sessionId ?? NULL_SESSION,
      name: ja.name,
      kind: "json",
      size: JSON.stringify(ja.data).length,
      visible: true,
      createdAt: ja.createdAt,
      updatedAt: ja.updatedAt,
      jsonData: ja.data,
    });
  }

  await writeMigrationData(db, records, notes);
  await reader.deleteLegacyArtifacts();
  await setMigrationFlag(db);
}
