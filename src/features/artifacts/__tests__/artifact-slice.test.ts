import { describe, expect, it, beforeEach, vi } from "vitest";
import { useStore, initStore } from "@/store/index";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";

function makeStorage(
  overrides?: Partial<ArtifactStoragePort>,
): ArtifactStoragePort & { setSessionId(id: string | null): void } {
  return {
    createOrUpdate: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    saveFile: vi.fn(),
    getFile: vi.fn().mockResolvedValue(null),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn(),
    clearAll: vi.fn(),
    setSessionId: () => undefined,
    ...overrides,
  };
}

describe("ArtifactSlice", () => {
  beforeEach(() => {
    initStore(makeStorage());
    useStore.setState(useStore.getInitialState());
  });

  it("初期状態が正しい", () => {
    const s = useStore.getState();
    expect(s.artifacts).toStrictEqual([]);
    expect(s.selectedArtifact).toBeNull();
  });

  it("loadArtifacts で JSON + ファイル一覧を取得してマージする", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue(["result.json"]),
      listFiles: vi.fn().mockResolvedValue(["photo.png", "result.json"]),
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    const { artifacts } = useStore.getState();
    expect(artifacts).toHaveLength(2);
    const names = artifacts.map((a) => a.name);
    expect(names).toContain("result.json");
    expect(names).toContain("photo.png");
  });

  it("loadArtifacts で型が正しく設定される", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue(["data.json"]),
      listFiles: vi.fn().mockResolvedValue(["photo.png"]),
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    const { artifacts } = useStore.getState();
    expect(artifacts.find((a) => a.name === "data.json")?.type).toBe("json");
    expect(artifacts.find((a) => a.name === "data.json")?.source).toBe("json");
    expect(artifacts.find((a) => a.name === "photo.png")?.type).toBe("image");
    expect(artifacts.find((a) => a.name === "photo.png")?.source).toBe("file");
  });

  it("selectArtifact で選択中ファイルを設定できる", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue(["data.json"]),
      listFiles: vi.fn().mockResolvedValue([]),
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    useStore.getState().selectArtifact("data.json");
    expect(useStore.getState().selectedArtifact).toBe("data.json");
  });

  it("removeArtifact で JSON アーティファクトを削除する", async () => {
    const deleteFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue(["data.json"]),
      listFiles: vi.fn().mockResolvedValue([]),
      delete: deleteFn,
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    useStore.getState().selectArtifact("data.json");
    await useStore.getState().removeArtifact("data.json");
    expect(deleteFn).toHaveBeenCalledWith("data.json");
    expect(useStore.getState().artifacts).toHaveLength(0);
    expect(useStore.getState().selectedArtifact).toBeNull();
  });

  it("removeArtifact で画像ファイルを deleteFile で削除する", async () => {
    const deleteFileFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([]),
      listFiles: vi.fn().mockResolvedValue(["photo.png"]),
      deleteFile: deleteFileFn,
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    await useStore.getState().removeArtifact("photo.png");
    expect(deleteFileFn).toHaveBeenCalledWith("photo.png");
    expect(useStore.getState().artifacts).toHaveLength(0);
  });

  it("removeArtifact で markdown ファイルを deleteFile で削除する", async () => {
    const deleteFileFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([]),
      listFiles: vi.fn().mockResolvedValue(["report.md"]),
      deleteFile: deleteFileFn,
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    await useStore.getState().removeArtifact("report.md");
    expect(deleteFileFn).toHaveBeenCalledWith("report.md");
    expect(useStore.getState().artifacts).toHaveLength(0);
  });

  it("removeArtifact で選択中でないアーティファクトを削除しても selectedArtifact は変わらない", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue(["a.json", "b.json"]),
      listFiles: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    useStore.getState().selectArtifact("a.json");
    await useStore.getState().removeArtifact("b.json");
    expect(useStore.getState().selectedArtifact).toBe("a.json");
  });

  it("clearArtifacts で UI 状態のみクリアする（ストレージは消さない）", async () => {
    const clearAllFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue(["data.json"]),
      listFiles: vi.fn().mockResolvedValue([]),
      clearAll: clearAllFn,
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    useStore.getState().selectArtifact("data.json");
    useStore.getState().clearArtifacts();
    expect(clearAllFn).not.toHaveBeenCalled();
    expect(useStore.getState().artifacts).toStrictEqual([]);
    expect(useStore.getState().selectedArtifact).toBeNull();
  });
});
