import type {
  ArtifactFile,
  ArtifactMeta,
  ArtifactStoragePort,
  ArtifactValue,
} from "@/ports/artifact-storage";
import { createLogger } from "@/shared/logger";
import { GLOBAL_SESSION_KEY, type StoredArtifactRecord } from "./artifact-record";
import {
  APP_META_STORE,
  ARTIFACTS_MIGRATION_DONE_KEY,
  ARTIFACTS_STORE,
  DEFAULT_DB_NAME,
  MIGRATION_NOTES_KEY,
  openTandemwebDatabase,
} from "./indexeddb-database";

const log = createLogger("artifact-storage");

type AppMetaRecord = {
  key: string;
  value: unknown;
  updatedAt: number;
};

export class ChromeArtifactStorage implements ArtifactStoragePort {
  private db: IDBDatabase | null = null;
  private sessionId: string | null = null;

  constructor(private readonly dbName = DEFAULT_DB_NAME) {}

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  async put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void> {
    const db = await this.getDB();
    const existing = await this.readRecord(name);
    const now = Date.now();
    const record: StoredArtifactRecord = {
      key: this.createKey(name),
      sessionId: this.sessionId,
      name,
      kind: value.kind,
      mimeType: value.kind === "file" ? value.mimeType : undefined,
      size: value.kind === "file" ? value.bytes.byteLength : this.getJsonSize(value.data),
      visible: options?.visible ?? existing?.visible ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      data: value.kind === "json" ? value.data : undefined,
      bytes: value.kind === "file" ? value.bytes : undefined,
    };

    await this.runWrite(db, [ARTIFACTS_STORE], (tx) => {
      tx.objectStore(ARTIFACTS_STORE).put(record);
    });
  }

  async get(name: string): Promise<ArtifactValue | null> {
    const record = await this.readRecord(name);
    if (!record) {
      return null;
    }

    if (record.kind === "json") {
      return { kind: "json", data: record.data };
    }

    return {
      kind: "file",
      bytes: record.bytes ?? new Uint8Array(),
      mimeType: record.mimeType ?? "application/octet-stream",
    };
  }

  async list(): Promise<ArtifactMeta[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ARTIFACTS_STORE, "readonly");
      const request = tx.objectStore(ARTIFACTS_STORE).openCursor();
      const records: ArtifactMeta[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          records.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(records);
          return;
        }

        const record = cursor.value as StoredArtifactRecord;
        if (record.sessionId === this.sessionId) {
          records.push(toMeta(record));
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(name: string): Promise<void> {
    const db = await this.getDB();
    await this.runWrite(db, [ARTIFACTS_STORE], (tx) => {
      tx.objectStore(ARTIFACTS_STORE).delete(this.createKey(name));
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    await this.runWrite(db, [ARTIFACTS_STORE], (tx) => {
      const store = tx.objectStore(ARTIFACTS_STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          return;
        }
        const record = cursor.value as StoredArtifactRecord;
        if (record.sessionId === this.sessionId) {
          store.delete(cursor.primaryKey);
        }
        cursor.continue();
      };
    });
  }

  async getMigrationFlag(): Promise<boolean> {
    const record = await this.readAppMeta(ARTIFACTS_MIGRATION_DONE_KEY);
    return record?.value === true;
  }

  async getMigrationNotes(): Promise<unknown[]> {
    const record = await this.readAppMeta(MIGRATION_NOTES_KEY);
    return Array.isArray(record?.value) ? record.value : [];
  }

  async createOrUpdate(name: string, data: unknown): Promise<void> {
    await this.put(name, { kind: "json", data });
  }

  async saveFile(name: string, contentBase64: string, mimeType: string): Promise<void> {
    await this.put(name, {
      kind: "file",
      bytes: base64ToBytes(contentBase64),
      mimeType,
    });
  }

  async getFile(name: string): Promise<ArtifactFile | null> {
    const value = await this.get(name);
    if (!value || value.kind !== "file") {
      return null;
    }

    const record = await this.readRecord(name);
    if (!record) {
      return null;
    }

    return {
      name,
      contentBase64: bytesToBase64(value.bytes),
      mimeType: value.mimeType,
      size: value.bytes.byteLength,
      createdAt: record.createdAt,
    };
  }

  async listFiles(): Promise<string[]> {
    const artifacts = await this.list();
    return artifacts
      .filter((artifact) => artifact.kind === "file")
      .map((artifact) => artifact.name);
  }

  async deleteFile(name: string): Promise<void> {
    const value = await this.get(name);
    if (value?.kind === "file") {
      await this.delete(name);
    }
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return openTandemwebDatabase({
      dbName: this.dbName,
      onSuccess: (db) => {
        this.db = db;
      },
      onError: (error) => {
        log.error("IndexedDB open エラー", error);
      },
    });
  }

  private async readRecord(name: string): Promise<StoredArtifactRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(ARTIFACTS_STORE, "readonly")
        .objectStore(ARTIFACTS_STORE)
        .get(this.createKey(name));
      request.onsuccess = () =>
        resolve((request.result as StoredArtifactRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async readAppMeta(key: string): Promise<AppMetaRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(APP_META_STORE, "readonly")
        .objectStore(APP_META_STORE)
        .get(key);
      request.onsuccess = () => resolve((request.result as AppMetaRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private createKey(name: string): string {
    return `${this.sessionId ?? GLOBAL_SESSION_KEY}::${name}`;
  }

  private getJsonSize(data: unknown): number {
    return new TextEncoder().encode(JSON.stringify(data)).byteLength;
  }

  private runWrite(
    db: IDBDatabase,
    storeNames: string[],
    handler: (tx: IDBTransaction) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, "readwrite");
      handler(tx);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

function toMeta(record: StoredArtifactRecord): ArtifactMeta {
  return {
    name: record.name,
    kind: record.kind,
    mimeType: record.mimeType,
    size: record.size,
    visible: record.visible,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}
