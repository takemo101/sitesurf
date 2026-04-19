import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryArtifactStorage } from "@/adapters/storage/in-memory-storage";
import type { ArtifactEntry } from "@/shared/artifact-types";
import { handleArtifactsTool } from "../artifacts-handler";

function makeSlice() {
  const state = {
    artifacts: [] as ArtifactEntry[],
    selectedArtifact: null as string | null,
    panelOpen: false,
  };
  return {
    state,
    slice: {
      get artifacts() {
        return state.artifacts;
      },
      get selectedArtifact() {
        return state.selectedArtifact;
      },
      setArtifacts: (v: ArtifactEntry[]) => {
        state.artifacts = v;
      },
      selectArtifact: (name: string | null) => {
        state.selectedArtifact = name;
      },
      setArtifactPanelOpen: (open: boolean) => {
        state.panelOpen = open;
      },
    },
  };
}

describe("handleArtifactsTool", () => {
  let storage: InMemoryArtifactStorage;
  let harness: ReturnType<typeof makeSlice>;

  beforeEach(() => {
    storage = new InMemoryArtifactStorage();
    harness = makeSlice();
  });

  describe("create", () => {
    it("saves .json files as kind:json", async () => {
      const result = await handleArtifactsTool(
        { command: "create", filename: "data.json", content: '{"foo":1}' },
        storage,
        harness.slice,
      );

      expect(result.isError).toBeFalsy();
      const stored = await storage.get("data.json");
      expect(stored).toEqual({ kind: "json", data: { foo: 1 } });
    });

    it("saves non-json files as kind:file with correct mimeType", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "page.html", content: "<!doctype html>" },
        storage,
        harness.slice,
      );

      const stored = await storage.get("page.html");
      expect(stored?.kind).toBe("file");
      if (stored?.kind !== "file") return;
      expect(stored.mimeType).toBe("text/html");
      expect(new TextDecoder().decode(stored.bytes)).toBe("<!doctype html>");
    });

    it("auto-opens panel for html files", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "x.html", content: "<p/>" },
        storage,
        harness.slice,
      );
      expect(harness.state.panelOpen).toBe(true);
    });

    it("does not auto-open panel for json", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "x.json", content: "{}" },
        storage,
        harness.slice,
      );
      expect(harness.state.panelOpen).toBe(false);
    });

    it("rejects duplicate create", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "x.txt", content: "a" },
        storage,
        harness.slice,
      );
      const second = await handleArtifactsTool(
        { command: "create", filename: "x.txt", content: "b" },
        storage,
        harness.slice,
      );
      expect(second.isError).toBe(true);
      expect(second.content).toContain("already exists");
    });

    it("returns actionable error for invalid JSON", async () => {
      const result = await handleArtifactsTool(
        { command: "create", filename: "bad.json", content: "{not valid}" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBe(true);
      expect(result.content).toContain("Invalid JSON content");
    });

    it("does not fail for unknown extensions", async () => {
      const result = await handleArtifactsTool(
        { command: "create", filename: "note.xyz", content: "hello" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBeFalsy();
      const stored = await storage.get("note.xyz");
      expect(stored?.kind).toBe("file");
      if (stored?.kind !== "file") return;
      expect(stored.mimeType).toBe("application/octet-stream");
    });
  });

  describe("rewrite", () => {
    it("replaces file content", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "x.txt", content: "old" },
        storage,
        harness.slice,
      );
      const result = await handleArtifactsTool(
        { command: "rewrite", filename: "x.txt", content: "new" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBeFalsy();
      const stored = await storage.get("x.txt");
      if (stored?.kind !== "file") throw new Error("expected file");
      expect(new TextDecoder().decode(stored.bytes)).toBe("new");
    });

    it("errors when file is missing", async () => {
      const result = await handleArtifactsTool(
        { command: "rewrite", filename: "missing.txt", content: "x" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBe(true);
      expect(result.content).toContain("not found");
    });
  });

  describe("update (find/replace)", () => {
    it("replaces substring in text file", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "doc.txt", content: "hello world" },
        storage,
        harness.slice,
      );
      const result = await handleArtifactsTool(
        { command: "update", filename: "doc.txt", old_str: "world", new_str: "there" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBeFalsy();
      const stored = await storage.get("doc.txt");
      if (stored?.kind !== "file") throw new Error("expected file");
      expect(new TextDecoder().decode(stored.bytes)).toBe("hello there");
    });

    it("surfaces full content when old_str not found", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "doc.txt", content: "hello world" },
        storage,
        harness.slice,
      );
      const result = await handleArtifactsTool(
        { command: "update", filename: "doc.txt", old_str: "foo", new_str: "bar" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBe(true);
      expect(result.content).toContain("hello world");
    });

    it("round-trips JSON via string replacement", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "cfg.json", content: '{"key":"old"}' },
        storage,
        harness.slice,
      );
      const result = await handleArtifactsTool(
        { command: "update", filename: "cfg.json", old_str: '"old"', new_str: '"new"' },
        storage,
        harness.slice,
      );
      expect(result.isError).toBeFalsy();
      const stored = await storage.get("cfg.json");
      expect(stored).toEqual({ kind: "json", data: { key: "new" } });
    });
  });

  describe("get", () => {
    it("returns pretty-printed JSON", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "x.json", content: '{"a":1}' },
        storage,
        harness.slice,
      );
      const result = await handleArtifactsTool(
        { command: "get", filename: "x.json" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBeFalsy();
      expect(result.content).toBe('{\n  "a": 1\n}');
    });

    it("returns decoded text for file artifacts", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "note.txt", content: "hello" },
        storage,
        harness.slice,
      );
      const result = await handleArtifactsTool(
        { command: "get", filename: "note.txt" },
        storage,
        harness.slice,
      );
      expect(result.content).toBe("hello");
    });

    it("errors when file is missing from slice", async () => {
      const result = await handleArtifactsTool(
        { command: "get", filename: "missing.txt" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBe(true);
    });
  });

  describe("delete", () => {
    it("removes from both storage and slice regardless of kind", async () => {
      await handleArtifactsTool(
        { command: "create", filename: "x.json", content: "{}" },
        storage,
        harness.slice,
      );
      await handleArtifactsTool(
        { command: "create", filename: "y.html", content: "<p/>" },
        storage,
        harness.slice,
      );

      await handleArtifactsTool({ command: "delete", filename: "x.json" }, storage, harness.slice);
      await handleArtifactsTool({ command: "delete", filename: "y.html" }, storage, harness.slice);

      expect(await storage.get("x.json")).toBeNull();
      expect(await storage.get("y.html")).toBeNull();
      expect(harness.state.artifacts).toEqual([]);
    });
  });

  describe("validation", () => {
    it("rejects missing command", async () => {
      const result = await handleArtifactsTool(
        // @ts-expect-error: validating runtime behavior
        { filename: "x.txt" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBe(true);
    });

    it("rejects missing filename", async () => {
      const result = await handleArtifactsTool(
        // @ts-expect-error: validating runtime behavior
        { command: "create" },
        storage,
        harness.slice,
      );
      expect(result.isError).toBe(true);
    });

    it("throws when aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
        handleArtifactsTool(
          { command: "create", filename: "x.txt", content: "a" },
          storage,
          harness.slice,
          controller.signal,
        ),
      ).rejects.toThrow("Execution aborted");
    });
  });
});
