import type { StoredToolResult, ToolResultStorePort } from "@/ports/tool-result-store";
import { createLogger } from "@/shared/logger";

const log = createLogger("indexeddb-tool-result-store");

const DB_NAME = "tandemweb";
const DB_VERSION = 2;
const STORE_NAME = "tool-results";
const SESSION_INDEX = "sessionId";
const SESSION_CREATED_INDEX = "sessionId_createdAt";

export class IndexedDBToolResultStore implements ToolResultStorePort {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("sessions-metadata")) {
          const meta = db.createObjectStore("sessions-metadata", { keyPath: "id" });
          meta.createIndex("lastModified", "lastModified");
        }

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex(SESSION_INDEX, "sessionId", { unique: false });
          store.createIndex(SESSION_CREATED_INDEX, ["sessionId", "createdAt"], { unique: false });
        }
      };

      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };

      req.onerror = () => {
        log.error("IndexedDB open error", req.error);
        reject(req.error);
      };
    });
  }

  async save(
    sessionId: string,
    result: Omit<StoredToolResult, "createdAt" | "sessionId">,
  ): Promise<void> {
    const db = await this.getDB();
    const record: StoredToolResult = {
      ...result,
      sessionId,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        log.error("save tool result error", tx.error);
        reject(tx.error);
      };
    });
  }

  async get(sessionId: string, key: string): Promise<StoredToolResult | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const value = (req.result as StoredToolResult | undefined) ?? null;
        if (value?.sessionId !== sessionId) {
          resolve(null);
          return;
        }
        resolve(value);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async list(sessionId: string): Promise<StoredToolResult[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index(SESSION_CREATED_INDEX);
      const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER]);
      const req = index.openCursor(range, "prev");
      const results: StoredToolResult[] = [];

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          results.push(cursor.value as StoredToolResult);
          cursor.continue();
          return;
        }
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const index = tx.objectStore(STORE_NAME).index(SESSION_INDEX);
      const req = index.openKeyCursor(IDBKeyRange.only(sessionId));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          tx.objectStore(STORE_NAME).delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        log.error("delete session tool results error", tx.error);
        reject(tx.error);
      };
    });
  }
}
