import { describe, expect, it, beforeEach, vi } from "vitest";
import { addOpenPanel, removeOpenPanel } from "../handlers/panel-tracker";

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

describe("panel-tracker", () => {
  describe("addOpenPanel", () => {
    it("パネルを追加できる", async () => {
      await addOpenPanel(100);
      expect(storage.open_panels).toStrictEqual([100]);
    });

    it("重複追加しない", async () => {
      await addOpenPanel(100);
      await addOpenPanel(100);
      expect(storage.open_panels).toStrictEqual([100]);
    });

    it("複数ウィンドウを追加できる", async () => {
      await addOpenPanel(100);
      await addOpenPanel(200);
      expect(storage.open_panels).toStrictEqual([100, 200]);
    });
  });

  describe("removeOpenPanel", () => {
    it("パネルを削除できる", async () => {
      storage.open_panels = [100, 200];
      await removeOpenPanel(100);
      expect(storage.open_panels).toStrictEqual([200]);
    });

    it("存在しないパネルの削除はエラーにならない", async () => {
      storage.open_panels = [200];
      await removeOpenPanel(100);
      expect(storage.open_panels).toStrictEqual([200]);
    });
  });
});
