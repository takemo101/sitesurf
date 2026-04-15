import type { SessionStoragePort } from "@/ports/session-storage";
import type { Session, SessionMeta } from "@/ports/session-types";
import { createLogger } from "@/shared/logger";

const log = createLogger("indexeddb-storage");

const DB_NAME = "tandemweb";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const METADATA_STORE = "sessions-metadata";

export class IndexedDBSessionStorage implements SessionStoragePort {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SESSIONS_STORE))
          db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const meta = db.createObjectStore(METADATA_STORE, { keyPath: "id" });
          meta.createIndex("lastModified", "lastModified");
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };
      req.onerror = () => {
        log.error("IndexedDB open エラー", req.error);
        reject(req.error);
      };
    });
  }

  async listSessions(): Promise<SessionMeta[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, "readonly");
      const index = tx.objectStore(METADATA_STORE).index("lastModified");
      const req = index.openCursor(null, "prev");
      const results: SessionMeta[] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getMetadata(id: string): Promise<SessionMeta | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(METADATA_STORE, "readonly").objectStore(METADATA_STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
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
      const req = db.transaction(SESSIONS_STORE, "readonly").objectStore(SESSIONS_STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSession(session: Session, meta: SessionMeta): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, METADATA_STORE], "readwrite");
      tx.objectStore(SESSIONS_STORE).put(session);
      tx.objectStore(METADATA_STORE).put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        log.error("IndexedDB saveSession エラー", tx.error);
        reject(tx.error);
      };
    });
  }

  async updateTitle(id: string, title: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, METADATA_STORE], "readwrite");

      const sessStore = tx.objectStore(SESSIONS_STORE);
      const sessReq = sessStore.get(id);
      sessReq.onsuccess = () => {
        if (sessReq.result) sessStore.put({ ...sessReq.result, title });
      };

      const metaStore = tx.objectStore(METADATA_STORE);
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
      const tx = db.transaction([SESSIONS_STORE, METADATA_STORE], "readwrite");
      tx.objectStore(SESSIONS_STORE).delete(id);
      tx.objectStore(METADATA_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        log.error("IndexedDB deleteSession エラー", tx.error);
        reject(tx.error);
      };
    });
  }
}
