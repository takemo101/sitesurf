import { describe, expect, it, beforeEach, vi } from "vitest";
import { acquireLock, releaseLock, releaseLocksForWindow } from "../handlers/session-lock";

const storage: Record<string, unknown> = {};

vi.stubGlobal("chrome", {
  storage: {
    session: {
      get: vi.fn(async (keys: string | string[]) => {
        const keyList = typeof keys === "string" ? [keys] : keys;
        const result: Record<string, unknown> = {};
        for (const key of keyList) {
          if (key in storage) result[key] = storage[key];
        }
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storage, items);
      }),
    },
  },
});

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
});

describe("session-lock", () => {
  describe("acquireLock", () => {
    it("空の状態でロック取得できる", async () => {
      const result = await acquireLock("session-1", 100);
      expect(result.success).toBe(true);
      expect(storage.session_locks).toStrictEqual({ "session-1": 100 });
    });

    it("同じウィンドウから再取得できる", async () => {
      await acquireLock("session-1", 100);
      const result = await acquireLock("session-1", 100);
      expect(result.success).toBe(true);
    });

    it("パネルが閉じているオーナーからロックを奪取できる", async () => {
      storage.session_locks = { "session-1": 200 };
      storage.open_panels = [];
      const result = await acquireLock("session-1", 100);
      expect(result.success).toBe(true);
      expect(storage.session_locks).toStrictEqual({ "session-1": 100 });
    });

    it("パネルが開いている別ウィンドウのロックは取得できない", async () => {
      storage.session_locks = { "session-1": 200 };
      storage.open_panels = [200];
      const result = await acquireLock("session-1", 100);
      expect(result.success).toBe(false);
    });
  });

  describe("releaseLock", () => {
    it("ロックを解放できる", async () => {
      storage.session_locks = { "session-1": 100 };
      await releaseLock("session-1");
      expect(storage.session_locks).toStrictEqual({});
    });

    it("存在しないロックの解放はエラーにならない", async () => {
      await releaseLock("nonexistent");
      expect(storage.session_locks).toStrictEqual({});
    });
  });

  describe("releaseLocksForWindow", () => {
    it("指定ウィンドウのロックを全て解放する", async () => {
      storage.session_locks = { s1: 100, s2: 100, s3: 200 };
      await releaseLocksForWindow(100);
      expect(storage.session_locks).toStrictEqual({ s3: 200 });
    });

    it("該当ロックがなければストレージは変更しない", async () => {
      storage.session_locks = { s1: 200 };
      const setSpy = vi.mocked(chrome.storage.session.set);
      setSpy.mockClear();
      await releaseLocksForWindow(100);
      expect(setSpy).not.toHaveBeenCalled();
    });
  });
});
