import { describe, expect, it } from "vitest";

import { InMemoryArtifactStorage } from "../in-memory-storage";

describe("InMemoryArtifactStorage", () => {
  it("setSessionId でセッションごとにデータを分離する", async () => {
    const storage = new InMemoryArtifactStorage();

    await storage.put("data.json", { kind: "json", data: { value: 1 } });
    await storage.put(
      "image.png",
      { kind: "file", bytes: new Uint8Array([104, 101, 108, 108, 111]), mimeType: "image/png" },
      { visible: false },
    );

    storage.setSessionId("session-1");
    await expect(storage.get("data.json")).resolves.toBeNull();
    await expect(storage.list()).resolves.toStrictEqual([]);

    await storage.put("data.json", { kind: "json", data: { value: 2 } });
    await expect(storage.get("data.json")).resolves.toStrictEqual({
      kind: "json",
      data: { value: 2 },
    });

    storage.setSessionId(null);
    await expect(storage.get("data.json")).resolves.toStrictEqual({
      kind: "json",
      data: { value: 1 },
    });
  });

  it("list は metadata を返し visible を保持する", async () => {
    const storage = new InMemoryArtifactStorage();

    await storage.put("data.json", { kind: "json", data: { value: 1 } }, { visible: false });
    await storage.put("note.md", {
      kind: "file",
      bytes: new TextEncoder().encode("hello"),
      mimeType: "text/markdown",
    });

    await expect(storage.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "note.md",
          kind: "file",
          visible: true,
          mimeType: "text/markdown",
        }),
        expect.objectContaining({ name: "data.json", kind: "json", visible: false }),
      ]),
    );
  });

  it("clearAll で現在セッションの artifact のみ消す", async () => {
    const storage = new InMemoryArtifactStorage();

    await storage.put("global.json", { kind: "json", data: { value: 1 } });
    storage.setSessionId("session-1");
    await storage.put("session.json", { kind: "json", data: { value: 2 } });

    await storage.clearAll();
    await expect(storage.get("session.json")).resolves.toBeNull();

    storage.setSessionId(null);
    await expect(storage.get("global.json")).resolves.toStrictEqual({
      kind: "json",
      data: { value: 1 },
    });
  });
});
