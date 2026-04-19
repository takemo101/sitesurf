import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import {
  IndexedDBArtifactStorage,
  runMigrationIfNeeded,
  type LegacyArtifactReader,
} from "../indexed-db-artifact-storage";
import { openTandemwebDatabase } from "../indexeddb-database";

function createDbName(): string {
  return `tandemweb-test-artifact-${Math.random().toString(36).slice(2)}`;
}

function makeStorage(dbName = createDbName()): IndexedDBArtifactStorage {
  return new IndexedDBArtifactStorage(dbName);
}

function makeLegacyReader(overrides: Partial<LegacyArtifactReader> = {}): LegacyArtifactReader {
  return {
    readLegacyJsonArtifacts: vi.fn().mockResolvedValue([]),
    readLegacyFileArtifacts: vi.fn().mockResolvedValue([]),
    deleteLegacyArtifacts: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("IndexedDBArtifactStorage", () => {
  describe("put / get", () => {
    it("JSON アーティファクトを保存・取得できる", async () => {
      const storage = makeStorage();
      const value = { kind: "json" as const, data: { x: 1, y: "hello" } };
      await storage.put("data.json", value);
      const result = await storage.get("data.json");
      expect(result).toEqual(value);
    });

    it("ファイルアーティファクト（バイナリ）を保存・取得できる", async () => {
      const storage = makeStorage();
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      const value = { kind: "file" as const, bytes, mimeType: "text/plain" };
      await storage.put("hello.txt", value);
      const result = await storage.get("hello.txt");
      expect(result?.kind).toBe("file");
      if (result?.kind === "file") {
        expect(result.bytes).toEqual(bytes);
        expect(result.mimeType).toBe("text/plain");
      }
    });

    it("存在しないアーティファクトの get は null を返す", async () => {
      const storage = makeStorage();
      expect(await storage.get("nonexistent.json")).toBeNull();
    });

    it("JSON の複雑なデータ構造が壊れずに保存・取得される", async () => {
      const storage = makeStorage();
      const data = {
        nested: { arr: [1, 2, 3], flag: true, nil: null },
        date: "2026-04-19",
      };
      await storage.put("complex.json", { kind: "json", data });
      const result = await storage.get("complex.json");
      expect(result).toEqual({ kind: "json", data });
    });
  });

  describe("list", () => {
    it("保存した JSON アーティファクトが list に含まれる", async () => {
      const storage = makeStorage();
      await storage.put("a.json", { kind: "json", data: 1 });
      await storage.put("b.json", { kind: "json", data: 2 });
      const list = await storage.list();
      const names = list.map((m) => m.name);
      expect(names).toContain("a.json");
      expect(names).toContain("b.json");
    });

    it("visible: false が list の meta に反映される", async () => {
      const storage = makeStorage();
      await storage.put("hidden.json", { kind: "json", data: 42 }, { visible: false });
      const list = await storage.list();
      const entry = list.find((m) => m.name === "hidden.json");
      expect(entry?.visible).toBe(false);
    });

    it("list の meta に正しい kind が入る", async () => {
      const storage = makeStorage();
      await storage.put("data.json", { kind: "json", data: {} });
      await storage.put("img.png", {
        kind: "file",
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
      });
      const list = await storage.list();
      expect(list.find((m) => m.name === "data.json")?.kind).toBe("json");
      expect(list.find((m) => m.name === "img.png")?.kind).toBe("file");
    });
  });

  describe("delete", () => {
    it("delete でアーティファクトを削除できる", async () => {
      const storage = makeStorage();
      await storage.put("temp.json", { kind: "json", data: "bye" });
      await storage.delete("temp.json");
      expect(await storage.get("temp.json")).toBeNull();
      const list = await storage.list();
      expect(list.find((m) => m.name === "temp.json")).toBeUndefined();
    });
  });

  describe("clearAll", () => {
    it("clearAll でセッションの全アーティファクトが削除される", async () => {
      const storage = makeStorage();
      await storage.put("x.json", { kind: "json", data: 1 });
      await storage.put("y.json", { kind: "json", data: 2 });
      await storage.clearAll();
      expect(await storage.list()).toHaveLength(0);
    });
  });

  describe("sessionId isolation", () => {
    it("異なる sessionId のアーティファクトは分離される", async () => {
      const dbName = createDbName();
      const storageA = new IndexedDBArtifactStorage(dbName);
      const storageB = new IndexedDBArtifactStorage(dbName);

      storageA.setSessionId("sess-a");
      storageB.setSessionId("sess-b");

      await storageA.put("file.json", { kind: "json", data: "from A" });
      await storageB.put("file.json", { kind: "json", data: "from B" });

      const resultA = await storageA.get("file.json");
      const resultB = await storageB.get("file.json");

      expect(resultA).toEqual({ kind: "json", data: "from A" });
      expect(resultB).toEqual({ kind: "json", data: "from B" });
    });

    it("session 切替で list が分離される", async () => {
      const dbName = createDbName();
      const storage = new IndexedDBArtifactStorage(dbName);

      storage.setSessionId("sess-1");
      await storage.put("only-in-1.json", { kind: "json", data: 1 });

      storage.setSessionId("sess-2");
      await storage.put("only-in-2.json", { kind: "json", data: 2 });

      const listIn2 = await storage.list();
      expect(listIn2.map((m) => m.name)).toContain("only-in-2.json");
      expect(listIn2.map((m) => m.name)).not.toContain("only-in-1.json");

      storage.setSessionId("sess-1");
      const listIn1 = await storage.list();
      expect(listIn1.map((m) => m.name)).toContain("only-in-1.json");
      expect(listIn1.map((m) => m.name)).not.toContain("only-in-2.json");
    });
  });
});

describe("runMigrationIfNeeded", () => {
  async function openDb(dbName: string): Promise<IDBDatabase> {
    return openTandemwebDatabase({ dbName });
  }

  it("旧 JSON アーティファクトが新ストアに移行される", async () => {
    const dbName = createDbName();
    const db = await openDb(dbName);
    const reader = makeLegacyReader({
      readLegacyJsonArtifacts: vi
        .fn()
        .mockResolvedValue([
          { name: "data.json", data: { v: 1 }, sessionId: null, createdAt: 1000, updatedAt: 2000 },
        ]),
    });

    await runMigrationIfNeeded(db, reader);

    const storage = new IndexedDBArtifactStorage(dbName);
    const result = await storage.get("data.json");
    expect(result).toEqual({ kind: "json", data: { v: 1 } });
  });

  it("旧 File アーティファクトが新ストアに移行される", async () => {
    const dbName = createDbName();
    const db = await openDb(dbName);
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const contentBase64 = btoa(String.fromCharCode(...pngBytes));
    const reader = makeLegacyReader({
      readLegacyFileArtifacts: vi.fn().mockResolvedValue([
        {
          name: "img.png",
          contentBase64,
          mimeType: "image/png",
          size: 4,
          sessionId: null,
          createdAt: 1000,
        },
      ]),
    });

    await runMigrationIfNeeded(db, reader);

    const storage = new IndexedDBArtifactStorage(dbName);
    const result = await storage.get("img.png");
    expect(result?.kind).toBe("file");
    if (result?.kind === "file") {
      expect(result.bytes).toEqual(pngBytes);
      expect(result.mimeType).toBe("image/png");
    }
  });

  it("名前衝突時は File が優先され JSON が負ける", async () => {
    const dbName = createDbName();
    const db = await openDb(dbName);
    const fileBytes = new Uint8Array([72, 105]);
    const contentBase64 = btoa(String.fromCharCode(...fileBytes));
    const reader = makeLegacyReader({
      readLegacyJsonArtifacts: vi.fn().mockResolvedValue([
        {
          name: "report.json",
          data: { json: true },
          sessionId: null,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]),
      readLegacyFileArtifacts: vi.fn().mockResolvedValue([
        {
          name: "report.json",
          contentBase64,
          mimeType: "application/json",
          size: 2,
          sessionId: null,
          createdAt: 2000,
        },
      ]),
    });

    await runMigrationIfNeeded(db, reader);

    const storage = new IndexedDBArtifactStorage(dbName);
    const result = await storage.get("report.json");
    expect(result?.kind).toBe("file");
  });

  it("2 回目の起動では migration が再実行されない", async () => {
    const dbName = createDbName();
    const db = await openDb(dbName);
    const reader = makeLegacyReader({
      readLegacyJsonArtifacts: vi
        .fn()
        .mockResolvedValue([
          { name: "once.json", data: 1, sessionId: null, createdAt: 1000, updatedAt: 1000 },
        ]),
    });

    await runMigrationIfNeeded(db, reader);
    await runMigrationIfNeeded(db, reader);

    expect(reader.readLegacyJsonArtifacts).toHaveBeenCalledTimes(1);
  });

  it("migration 後に deleteLegacyArtifacts が呼ばれる", async () => {
    const dbName = createDbName();
    const db = await openDb(dbName);
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const reader = makeLegacyReader({
      readLegacyJsonArtifacts: vi
        .fn()
        .mockResolvedValue([
          { name: "a.json", data: 1, sessionId: null, createdAt: 1000, updatedAt: 1000 },
        ]),
      deleteLegacyArtifacts: deleteFn,
    });

    await runMigrationIfNeeded(db, reader);

    expect(deleteFn).toHaveBeenCalledOnce();
  });

  it("旧データが空の場合も migration フラグが立つ（次回スキップされる）", async () => {
    const dbName = createDbName();
    const db = await openDb(dbName);
    const reader = makeLegacyReader();

    await runMigrationIfNeeded(db, reader);
    // 2 回目は reader が呼ばれない
    await runMigrationIfNeeded(db, reader);

    expect(reader.readLegacyJsonArtifacts).toHaveBeenCalledTimes(1);
  });
});
