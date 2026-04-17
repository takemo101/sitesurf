import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDBSessionStorage } from "../indexeddb-session-storage";
import { IndexedDBToolResultStore } from "../indexeddb-tool-result-store";
import type { Session, SessionMeta } from "@/ports/session-types";

function createSession(id: string): Session {
  return {
    id,
    title: `Session ${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    model: "gpt-4",
    messages: [],
    history: [],
  };
}

function createMeta(id: string): SessionMeta {
  return {
    id,
    title: `Session ${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastModified: "2026-01-01T00:00:00.000Z",
    messageCount: 0,
    modelId: "gpt-4",
    preview: "",
  };
}

function createDbName(suffix: string): string {
  return `tandemweb-test-${suffix}-${Math.random().toString(36).slice(2)}`;
}

function createLegacyV1Database(
  name: string,
  options: { session?: Session; meta?: SessionMeta } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      const sessions = db.createObjectStore("sessions", { keyPath: "id" });
      const metadata = db.createObjectStore("sessions-metadata", { keyPath: "id" });
      metadata.createIndex("lastModified", "lastModified");

      if (options.session) {
        sessions.put(options.session);
      }

      if (options.meta) {
        metadata.put(options.meta);
      }
    };

    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

describe("tandemweb indexeddb schema", () => {
  it("lets session storage open the same database after tool-result storage created it", async () => {
    const dbName = createDbName("shared");
    const toolStore = new IndexedDBToolResultStore(dbName);

    await toolStore.save("session-1", {
      key: "tc_shared",
      toolName: "read_page",
      fullValue: "full result",
      summary: "summary",
      turnIndex: 0,
    });

    const sessionStorage = new IndexedDBSessionStorage(dbName);

    await expect(sessionStorage.getLatestSessionId()).resolves.toBeNull();
  });

  it("upgrades a legacy v1 database with session data without losing records", async () => {
    const dbName = createDbName("legacy-with-data");

    await createLegacyV1Database(dbName, {
      session: createSession("legacy-session"),
      meta: createMeta("legacy-session"),
    });

    const sessionStorage = new IndexedDBSessionStorage(dbName);
    const toolStore = new IndexedDBToolResultStore(dbName);

    await expect(sessionStorage.getSession("legacy-session")).resolves.toEqual(
      createSession("legacy-session"),
    );

    await toolStore.save("legacy-session", {
      key: "tc_legacy",
      toolName: "read_page",
      fullValue: "full result",
      summary: "summary",
      turnIndex: 1,
    });

    await expect(toolStore.get("legacy-session", "tc_legacy")).resolves.toMatchObject({
      key: "tc_legacy",
      sessionId: "legacy-session",
    });
  });

  it("upgrades an empty legacy v1 database to include tool-results store on first session open", async () => {
    const dbName = createDbName("legacy-empty");

    await createLegacyV1Database(dbName);

    const sessionStorage = new IndexedDBSessionStorage(dbName);

    await expect(sessionStorage.getLatestSessionId()).resolves.toBeNull();

    const db = await openDatabase(dbName);
    expect(Array.from(db.objectStoreNames)).toContain("tool-results");
    db.close();
  });
});
