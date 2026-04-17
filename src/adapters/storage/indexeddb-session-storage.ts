import type { SessionStoragePort } from "@/ports/session-storage";
import type { Session, SessionMeta } from "@/ports/session-types";
import { createLogger } from "@/shared/logger";
import {
  DEFAULT_DB_NAME,
  LAST_MODIFIED_INDEX,
  METADATA_STORE,
  SESSIONS_STORE,
  openTandemwebDatabase,
} from "./indexeddb-database";

const log = createLogger("indexeddb-storage");

export class IndexedDBSessionStorage implements SessionStoragePort {
  private db: IDBDatabase | null = null;

  constructor(private readonly dbName = DEFAULT_DB_NAME) {}

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
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

  async listSessions(): Promise<SessionMeta[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, "readonly");
      const index = tx.objectStore(METADATA_STORE).index(LAST_MODIFIED_INDEX);
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
