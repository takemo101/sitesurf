import type { StoredToolResult, ToolResultStorePort } from "@/ports/tool-result-store";
import { createLogger } from "@/shared/logger";
import {
  DEFAULT_DB_NAME,
  TOOL_RESULTS_SESSION_CREATED_INDEX,
  TOOL_RESULTS_SESSION_INDEX,
  TOOL_RESULTS_STORE,
  openTandemwebDatabase,
} from "./indexeddb-database";

const log = createLogger("indexeddb-tool-result-store");

export class IndexedDBToolResultStore implements ToolResultStorePort {
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
        log.error("IndexedDB open error", error);
      },
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
      const tx = db.transaction(TOOL_RESULTS_STORE, "readwrite");
      tx.objectStore(TOOL_RESULTS_STORE).put(record);
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
      const req = db
        .transaction(TOOL_RESULTS_STORE, "readonly")
        .objectStore(TOOL_RESULTS_STORE)
        .get(key);
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
      const tx = db.transaction(TOOL_RESULTS_STORE, "readonly");
      const index = tx.objectStore(TOOL_RESULTS_STORE).index(TOOL_RESULTS_SESSION_CREATED_INDEX);
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
      const tx = db.transaction(TOOL_RESULTS_STORE, "readwrite");
      const index = tx.objectStore(TOOL_RESULTS_STORE).index(TOOL_RESULTS_SESSION_INDEX);
      const req = index.openKeyCursor(IDBKeyRange.only(sessionId));

      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          tx.objectStore(TOOL_RESULTS_STORE).delete(cursor.primaryKey);
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
