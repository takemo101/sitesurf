import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeStorageAdapter } from "../chrome-storage";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockGet,
      set: mockSet,
      remove: mockRemove,
    },
  },
});

describe("ChromeStorageAdapter", () => {
  let adapter: ChromeStorageAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ChromeStorageAdapter();
  });

  describe("get", () => {
    it("returns stored value", async () => {
      mockGet.mockResolvedValue({ myKey: { name: "test" } });

      const result = await adapter.get<{ name: string }>("myKey");
      expect(result).toEqual({ name: "test" });
      expect(mockGet).toHaveBeenCalledWith(["myKey"]);
    });

    it("returns null for missing key", async () => {
      mockGet.mockResolvedValue({});

      const result = await adapter.get("missing");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("stores value via chrome.storage.local.set", async () => {
      mockSet.mockResolvedValue(undefined);

      await adapter.set("key", { data: 42 });
      expect(mockSet).toHaveBeenCalledWith({ key: { data: 42 } });
    });
  });

  describe("remove", () => {
    it("removes key via chrome.storage.local.remove", async () => {
      mockRemove.mockResolvedValue(undefined);

      await adapter.remove("key");
      expect(mockRemove).toHaveBeenCalledWith("key");
    });
  });
});
