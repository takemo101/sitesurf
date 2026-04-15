import { describe, expect, it } from "vitest";

import { InMemoryArtifactStorage } from "../in-memory-storage";

describe("InMemoryArtifactStorage", () => {
  it("setSessionId は no-op で既存データを保持する", async () => {
    const storage = new InMemoryArtifactStorage();

    await storage.createOrUpdate("data.json", { value: 1 });
    await storage.saveFile("image.png", "aGVsbG8=", "image/png");
    storage.setSessionId("session-1");

    await expect(storage.get("data.json")).resolves.toStrictEqual({ value: 1 });
    await expect(storage.getFile("image.png")).resolves.toMatchObject({
      name: "image.png",
      mimeType: "image/png",
    });
    await expect(storage.list()).resolves.toStrictEqual(["data.json"]);
    await expect(storage.listFiles()).resolves.toStrictEqual(["image.png"]);
  });

  it("clearAll で JSON とファイルを両方消す", async () => {
    const storage = new InMemoryArtifactStorage();

    await storage.createOrUpdate("data.json", { value: 1 });
    await storage.saveFile("image.png", "aGVsbG8=", "image/png");
    await storage.clearAll();

    await expect(storage.get("data.json")).resolves.toBeNull();
    await expect(storage.getFile("image.png")).resolves.toBeNull();
  });
});
