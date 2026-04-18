import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDBSessionStorage } from "../indexeddb-session-storage";
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

function createLegacyV2Database(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 2);

    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("sessions", { keyPath: "id" });
      const metadata = db.createObjectStore("sessions-metadata", { keyPath: "id" });
      metadata.createIndex("lastModified", "lastModified");
      const toolResults = db.createObjectStore("tool-results", { keyPath: "key" });
      toolResults.createIndex("sessionId", "sessionId", { unique: false });
      toolResults.createIndex("sessionId_createdAt", ["sessionId", "createdAt"], { unique: false });
      toolResults.put({
        key: "tc_legacy",
        sessionId: "legacy-session",
        toolName: "read_page",
        fullValue: "legacy",
        summary: "legacy",
        turnIndex: 0,
        createdAt: Date.now(),
      });
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
  it("upgrades a legacy v1 database with session data without losing records", async () => {
    const dbName = createDbName("legacy-with-data");

    await createLegacyV1Database(dbName, {
      session: createSession("legacy-session"),
      meta: createMeta("legacy-session"),
    });

    const sessionStorage = new IndexedDBSessionStorage(dbName);

    await expect(sessionStorage.getSession("legacy-session")).resolves.toEqual(
      createSession("legacy-session"),
    );
  });

  it("drops the legacy v2 tool-results store during v3 migration", async () => {
    const dbName = createDbName("legacy-v2-tool-results");
    await createLegacyV2Database(dbName);

    // Trigger the v3 upgrade by opening the database through SessionStorage.
    const sessionStorage = new IndexedDBSessionStorage(dbName);
    await expect(sessionStorage.getLatestSessionId()).resolves.toBeNull();

    const db = await openDatabase(dbName);
    expect(Array.from(db.objectStoreNames)).not.toContain("tool-results");
    expect(Array.from(db.objectStoreNames)).toContain("sessions");
    expect(Array.from(db.objectStoreNames)).toContain("sessions-metadata");
    db.close();
  });
});
