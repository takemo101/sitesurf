import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDBToolResultStore } from "../indexeddb-tool-result-store";

describe("IndexedDBToolResultStore", () => {
  let store: IndexedDBToolResultStore;

  beforeEach(() => {
    store = new IndexedDBToolResultStore();
  });

  it("saves and retrieves a stored tool result", async () => {
    await store.save("session-1", {
      key: "tc_one",
      toolName: "read_page",
      fullValue: "full result",
      summary: "summary",
      turnIndex: 2,
    });

    const result = await store.get("session-1", "tc_one");

    expect(result).toMatchObject({
      key: "tc_one",
      sessionId: "session-1",
      toolName: "read_page",
      fullValue: "full result",
      summary: "summary",
      turnIndex: 2,
    });
  });

  it("isolates results by sessionId", async () => {
    await store.save("session-1", {
      key: "tc_shared",
      toolName: "read_page",
      fullValue: "full result",
      summary: "summary",
      turnIndex: 0,
    });

    await expect(store.get("session-2", "tc_shared")).resolves.toBeNull();
  });

  it("lists newest results first for a session", async () => {
    await store.save("session-list", {
      key: "tc_old",
      toolName: "navigate",
      fullValue: "old",
      summary: "old",
      turnIndex: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await store.save("session-list", {
      key: "tc_new",
      toolName: "read_page",
      fullValue: "new",
      summary: "new",
      turnIndex: 1,
    });

    const results = await store.list("session-list");
    expect(results.map((result) => result.key)).toEqual(["tc_new", "tc_old"]);
  });

  it("deletes only one session namespace", async () => {
    await store.save("session-1", {
      key: "tc_a",
      toolName: "read_page",
      fullValue: "a",
      summary: "a",
      turnIndex: 0,
    });
    await store.save("session-2", {
      key: "tc_b",
      toolName: "read_page",
      fullValue: "b",
      summary: "b",
      turnIndex: 0,
    });

    await store.deleteSession("session-1");

    await expect(store.get("session-1", "tc_a")).resolves.toBeNull();
    await expect(store.get("session-2", "tc_b")).resolves.toMatchObject({ key: "tc_b" });
  });
});
