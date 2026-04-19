import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { ChromeArtifactStorage } from "../artifact-storage";
import {
  APP_META_STORE,
  ARTIFACTS_MIGRATION_DONE_KEY,
  ARTIFACTS_STORE,
  MIGRATION_NOTES_KEY,
} from "../indexeddb-database";

function createDbName(suffix: string): string {
  return `tandemweb-artifacts-${suffix}-${Math.random().toString(36).slice(2)}`;
}

function openDatabase(name: string, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version ? indexedDB.open(name, version) : indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readStoreValue<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function createLegacyArtifactsDatabase(
  name: string,
  options?: { withCollision?: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 3);

    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("sessions", { keyPath: "id" });
      const metadata = db.createObjectStore("sessions-metadata", { keyPath: "id" });
      metadata.createIndex("lastModified", "lastModified");
      const jsonStore = db.createObjectStore("json-artifacts", { keyPath: "name" });
      const fileStore = db.createObjectStore("files", { keyPath: "name" });

      jsonStore.put({
        name: "data.json",
        data: { value: 1 },
        createdAt: 10,
        updatedAt: 20,
        visible: true,
        sessionId: null,
      });
      jsonStore.put({
        name: "shared.txt",
        data: { source: "json" },
        createdAt: 11,
        updatedAt: 21,
        visible: false,
        sessionId: null,
      });

      fileStore.put({
        name: options?.withCollision ? "shared.txt" : "image.png",
        contentBase64: Buffer.from(options?.withCollision ? "file wins" : "png-bytes").toString(
          "base64",
        ),
        mimeType: options?.withCollision ? "text/plain" : "image/png",
        size: options?.withCollision ? 9 : 9,
        createdAt: 30,
        updatedAt: 40,
        visible: true,
        sessionId: null,
      });
    };

    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

describe("ChromeArtifactStorage", () => {
  let dbName: string;
  let storage: ChromeArtifactStorage;

  beforeEach(() => {
    dbName = createDbName("case");
    storage = new ChromeArtifactStorage(dbName);
  });

  it("put/get で JSON 値を保持する", async () => {
    const data = { nested: { count: 1 }, list: [1, 2, 3] };

    await storage.put("data.json", { kind: "json", data });

    await expect(storage.get("data.json")).resolves.toStrictEqual({ kind: "json", data });
  });

  it("put/get で Uint8Array を保持する", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);

    await storage.put("file.bin", { kind: "file", bytes, mimeType: "application/octet-stream" });

    await expect(storage.get("file.bin")).resolves.toStrictEqual({
      kind: "file",
      bytes,
      mimeType: "application/octet-stream",
    });
  });

  it("list は visible false を含む metadata を返す", async () => {
    await storage.put("hidden.json", { kind: "json", data: { ok: true } }, { visible: false });

    await expect(storage.list()).resolves.toEqual([
      expect.objectContaining({ name: "hidden.json", kind: "json", visible: false }),
    ]);
  });

  it("delete で artifact を削除する", async () => {
    await storage.put("remove.json", { kind: "json", data: { ok: true } });
    await storage.delete("remove.json");

    await expect(storage.get("remove.json")).resolves.toBeNull();
  });

  it("sessionId ごとに artifact が分離される", async () => {
    await storage.put("shared.json", { kind: "json", data: { session: "global" } });

    storage.setSessionId("s1");
    await expect(storage.get("shared.json")).resolves.toBeNull();
    await storage.put("shared.json", { kind: "json", data: { session: "s1" } });

    await expect(storage.get("shared.json")).resolves.toStrictEqual({
      kind: "json",
      data: { session: "s1" },
    });

    storage.setSessionId(null);
    await expect(storage.get("shared.json")).resolves.toStrictEqual({
      kind: "json",
      data: { session: "global" },
    });
  });

  it("clearAll は現在セッションの artifact のみ削除する", async () => {
    await storage.put("global.json", { kind: "json", data: { scope: "global" } });
    storage.setSessionId("s1");
    await storage.put("session.json", { kind: "json", data: { scope: "s1" } });

    await storage.clearAll();
    await expect(storage.get("session.json")).resolves.toBeNull();

    storage.setSessionId(null);
    await expect(storage.get("global.json")).resolves.toStrictEqual({
      kind: "json",
      data: { scope: "global" },
    });
  });

  it("既存 artifact を put すると createdAt を維持し updatedAt を更新する", async () => {
    await storage.put("data.json", { kind: "json", data: { value: 1 } });
    const [before] = await storage.list();

    await new Promise((resolve) => setTimeout(resolve, 1));
    await storage.put("data.json", { kind: "json", data: { value: 2 } }, { visible: false });

    const [after] = await storage.list();
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    expect(after.visible).toBe(false);
  });

  it("legacy 2 store から unified store へ migration する", async () => {
    const legacyDbName = createDbName("legacy");
    await createLegacyArtifactsDatabase(legacyDbName);

    const migratedStorage = new ChromeArtifactStorage(legacyDbName);
    const artifacts = await migratedStorage.list();

    expect(artifacts.map((artifact) => artifact.name).sort()).toStrictEqual([
      "data.json",
      "image.png",
      "shared.txt",
    ]);

    const db = await openDatabase(legacyDbName);
    expect(Array.from(db.objectStoreNames)).toContain(ARTIFACTS_STORE);
    expect(Array.from(db.objectStoreNames)).not.toContain("json-artifacts");
    expect(Array.from(db.objectStoreNames)).not.toContain("files");
    expect(
      await readStoreValue<{ value: boolean }>(db, APP_META_STORE, ARTIFACTS_MIGRATION_DONE_KEY),
    ).toMatchObject({
      value: true,
    });
    db.close();
  });

  it("migration の名前衝突は file を優先し notes に losingKind を残す", async () => {
    const legacyDbName = createDbName("collision");
    await createLegacyArtifactsDatabase(legacyDbName, { withCollision: true });

    const migratedStorage = new ChromeArtifactStorage(legacyDbName);
    const value = await migratedStorage.get("shared.txt");
    expect(value).toStrictEqual({
      kind: "file",
      bytes: new Uint8Array(Buffer.from("file wins")),
      mimeType: "text/plain",
    });

    const db = await openDatabase(legacyDbName);
    expect(
      await readStoreValue<{ value: unknown[] }>(db, APP_META_STORE, MIGRATION_NOTES_KEY),
    ).toEqual({
      key: MIGRATION_NOTES_KEY,
      value: [expect.objectContaining({ name: "shared.txt", losingKind: "json" })],
      updatedAt: expect.any(Number),
    });
    db.close();
  });

  it("2 回目の起動で migration 結果が重複しない", async () => {
    const legacyDbName = createDbName("rerun");
    await createLegacyArtifactsDatabase(legacyDbName);

    const first = new ChromeArtifactStorage(legacyDbName);
    await first.list();

    const second = new ChromeArtifactStorage(legacyDbName);
    const artifacts = await second.list();
    expect(artifacts).toHaveLength(3);

    const db = await openDatabase(legacyDbName);
    const notes = await readStoreValue<{ value: unknown[] }>(
      db,
      APP_META_STORE,
      MIGRATION_NOTES_KEY,
    );
    expect(Array.isArray(notes?.value)).toBe(true);
    db.close();
  });
});
