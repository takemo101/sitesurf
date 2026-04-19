import { describe, expect, it, beforeEach, vi } from "vitest";
import { useStore, initStore } from "@/store/index";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";

function makeStorage(
  overrides?: Partial<ArtifactStoragePort>,
): ArtifactStoragePort & { setSessionId(id: string | null): void } {
  return {
    put: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    clearAll: vi.fn(),
    setSessionId: () => undefined,
    createOrUpdate: vi.fn(),
    saveFile: vi.fn(),
    getFile: vi.fn().mockResolvedValue(null),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn(),
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
      list: vi.fn().mockResolvedValue([
        {
          name: "result.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
        {
          name: "photo.png",
          kind: "file",
          mimeType: "image/png",
          size: 20,
          visible: true,
          createdAt: 1,
          updatedAt: 3,
        },
      ]),
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
      list: vi.fn().mockResolvedValue([
        {
          name: "data.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
        {
          name: "photo.png",
          kind: "file",
          mimeType: "image/png",
          size: 20,
          visible: true,
          createdAt: 1,
          updatedAt: 3,
        },
      ]),
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    const { artifacts } = useStore.getState();
    expect(artifacts.find((a) => a.name === "data.json")?.type).toBe("json");
    expect(artifacts.find((a) => a.name === "data.json")?.source).toBe("json");
    expect(artifacts.find((a) => a.name === "photo.png")?.type).toBe("image");
    expect(artifacts.find((a) => a.name === "photo.png")?.source).toBe("file");
  });

  it("loadArtifacts で visible false の artifact を除外する", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([
        {
          name: "hidden.json",
          kind: "json",
          size: 10,
          visible: false,
          createdAt: 1,
          updatedAt: 2,
        },
        {
          name: "shown.png",
          kind: "file",
          mimeType: "image/png",
          size: 20,
          visible: true,
          createdAt: 1,
          updatedAt: 3,
        },
      ]),
    });
    initStore(storage);

    await useStore.getState().loadArtifacts();

    expect(useStore.getState().artifacts).toStrictEqual([
      {
        name: "shown.png",
        type: "image",
        source: "file",
        updatedAt: 3,
      },
    ]);
  });

  it("selectArtifact で選択中ファイルを設定できる", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([
        {
          name: "data.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    useStore.getState().selectArtifact("data.json");
    expect(useStore.getState().selectedArtifact).toBe("data.json");
  });

  it("removeArtifact で JSON アーティファクトを削除する", async () => {
    const deleteFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([
        {
          name: "data.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
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

  it("removeArtifact で画像ファイルを削除する", async () => {
    const deleteFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([
        {
          name: "photo.png",
          kind: "file",
          mimeType: "image/png",
          size: 20,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
      delete: deleteFn,
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    await useStore.getState().removeArtifact("photo.png");
    expect(deleteFn).toHaveBeenCalledWith("photo.png");
    expect(useStore.getState().artifacts).toHaveLength(0);
  });

  it("removeArtifact で markdown ファイルを削除する", async () => {
    const deleteFn = vi.fn();
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([
        {
          name: "report.md",
          kind: "file",
          mimeType: "text/markdown",
          size: 20,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
      delete: deleteFn,
    });
    initStore(storage);
    await useStore.getState().loadArtifacts();
    await useStore.getState().removeArtifact("report.md");
    expect(deleteFn).toHaveBeenCalledWith("report.md");
    expect(useStore.getState().artifacts).toHaveLength(0);
  });

  it("removeArtifact で選択中でないアーティファクトを削除しても selectedArtifact は変わらない", async () => {
    const storage = makeStorage({
      list: vi.fn().mockResolvedValue([
        {
          name: "a.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
        {
          name: "b.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 3,
        },
      ]),
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
      list: vi.fn().mockResolvedValue([
        {
          name: "data.json",
          kind: "json",
          size: 10,
          visible: true,
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
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
