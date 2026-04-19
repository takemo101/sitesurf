import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryArtifactStorage } from "@/adapters/storage/in-memory-storage";
import type { ProviderContext } from "@/ports/runtime-provider";
import { ArtifactProvider, inferArtifactValue } from "../artifact-provider";

function makeContext(storage: InMemoryArtifactStorage): ProviderContext {
  return {
    browser: {} as ProviderContext["browser"],
    artifactStorage: storage,
  };
}

describe("ArtifactProvider.handleRequest", () => {
  let provider: ArtifactProvider;
  let storage: InMemoryArtifactStorage;
  let ctx: ProviderContext;

  beforeEach(() => {
    provider = new ArtifactProvider();
    storage = new InMemoryArtifactStorage();
    ctx = makeContext(storage);
  });

  describe("saveArtifact", () => {
    it("saves objects as kind:json", async () => {
      const result = await provider.handleRequest(
        { id: "1", action: "saveArtifact", name: "products", data: [{ name: "A" }] },
        ctx,
      );

      expect(result.ok).toBe(true);
      const stored = await storage.get("products");
      expect(stored).toEqual({ kind: "json", data: [{ name: "A" }] });
    });

    it("saves strings without extension as kind:json", async () => {
      await provider.handleRequest(
        { id: "1", action: "saveArtifact", name: "note", data: "hello" },
        ctx,
      );
      const stored = await storage.get("note");
      expect(stored).toEqual({ kind: "json", data: "hello" });
    });

    it("saves strings with extension as kind:file (UTF-8)", async () => {
      await provider.handleRequest(
        { id: "1", action: "saveArtifact", name: "report.html", data: "<h1>ok</h1>" },
        ctx,
      );
      const stored = await storage.get("report.html");
      expect(stored?.kind).toBe("file");
      if (stored?.kind !== "file") return;
      expect(stored.mimeType).toBe("text/html");
      expect(new TextDecoder().decode(stored.bytes)).toBe("<h1>ok</h1>");
    });

    it("saves strings with explicit mimeType as kind:file even without extension", async () => {
      await provider.handleRequest(
        {
          id: "1",
          action: "saveArtifact",
          name: "untitled",
          data: "raw text",
          mimeType: "text/plain",
        },
        ctx,
      );
      const stored = await storage.get("untitled");
      expect(stored?.kind).toBe("file");
      if (stored?.kind !== "file") return;
      expect(stored.mimeType).toBe("text/plain");
    });

    it("saves Uint8Array as kind:file with inferred mimeType", async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      await provider.handleRequest(
        { id: "1", action: "saveArtifact", name: "icon.png", data: bytes },
        ctx,
      );
      const stored = await storage.get("icon.png");
      expect(stored?.kind).toBe("file");
      if (stored?.kind !== "file") return;
      expect(stored.mimeType).toBe("image/png");
      expect(Array.from(stored.bytes)).toEqual([1, 2, 3]);
    });

    it("respects visible: false", async () => {
      await provider.handleRequest(
        {
          id: "1",
          action: "saveArtifact",
          name: "_debug",
          data: { log: 1 },
          visible: false,
        },
        ctx,
      );
      const list = await storage.list();
      const entry = list.find((a) => a.name === "_debug");
      expect(entry?.visible).toBe(false);
    });

    it("defaults to visible: true when option omitted", async () => {
      await provider.handleRequest(
        { id: "1", action: "saveArtifact", name: "public", data: { x: 1 } },
        ctx,
      );
      const list = await storage.list();
      expect(list.find((a) => a.name === "public")?.visible).toBe(true);
    });
  });

  describe("getArtifact", () => {
    it("returns ArtifactValue for json", async () => {
      await storage.put("x", { kind: "json", data: { foo: 1 } });
      const result = await provider.handleRequest(
        { id: "1", action: "getArtifact", name: "x" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({ kind: "json", data: { foo: 1 } });
    });

    it("returns ArtifactValue for file", async () => {
      await storage.put("y.png", {
        kind: "file",
        bytes: new Uint8Array([9, 8, 7]),
        mimeType: "image/png",
      });
      const result = await provider.handleRequest(
        { id: "1", action: "getArtifact", name: "y.png" },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as { kind: string; bytes: Uint8Array; mimeType: string };
      expect(value.kind).toBe("file");
      expect(Array.from(value.bytes)).toEqual([9, 8, 7]);
      expect(value.mimeType).toBe("image/png");
    });

    it("returns error when missing", async () => {
      const result = await provider.handleRequest(
        { id: "1", action: "getArtifact", name: "nope" },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });
  });

  describe("listArtifacts", () => {
    it("returns ArtifactMeta[] with both kinds", async () => {
      await storage.put("a.json", { kind: "json", data: { x: 1 } });
      await storage.put("b.html", {
        kind: "file",
        bytes: new TextEncoder().encode("<p/>"),
        mimeType: "text/html",
      });
      const result = await provider.handleRequest({ id: "1", action: "listArtifacts" }, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const list = result.value as Array<{ name: string; kind: string }>;
      const names = list.map((a) => a.name).sort();
      expect(names).toEqual(["a.json", "b.html"]);
      const kinds = Object.fromEntries(list.map((a) => [a.name, a.kind]));
      expect(kinds).toEqual({ "a.json": "json", "b.html": "file" });
    });
  });

  describe("deleteArtifact", () => {
    it("deletes regardless of kind", async () => {
      await storage.put("x.json", { kind: "json", data: {} });
      await provider.handleRequest({ id: "1", action: "deleteArtifact", name: "x.json" }, ctx);
      expect(await storage.get("x.json")).toBeNull();
    });
  });

  describe("legacy wire protocol (removed in v0.1.7)", () => {
    it("createOrUpdateArtifact は Unknown action エラーになる", async () => {
      const result = await provider.handleRequest(
        { id: "1", action: "createOrUpdateArtifact", name: "legacy", data: { foo: 1 } },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Unknown artifact action");
    });

    it("returnFile は Unknown action エラーになる", async () => {
      const contentBase64 = btoa("hello");
      const result = await provider.handleRequest(
        {
          id: "1",
          action: "returnFile",
          name: "legacy.txt",
          contentBase64,
          mimeType: "text/plain",
        },
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Unknown artifact action");
    });
  });

  it("rejects unknown action", async () => {
    const result = await provider.handleRequest({ id: "1", action: "bogus" }, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Unknown artifact action");
  });
});

describe("inferArtifactValue", () => {
  it("Uint8Array → file", () => {
    const value = inferArtifactValue("x.bin", new Uint8Array([1, 2]), undefined);
    expect(value.kind).toBe("file");
  });

  it("object → json", () => {
    const value = inferArtifactValue("x", { foo: 1 }, undefined);
    expect(value).toEqual({ kind: "json", data: { foo: 1 } });
  });

  it("null → json", () => {
    const value = inferArtifactValue("x", null, undefined);
    expect(value).toEqual({ kind: "json", data: null });
  });

  it("number → json", () => {
    const value = inferArtifactValue("x", 42, undefined);
    expect(value).toEqual({ kind: "json", data: 42 });
  });

  it("boolean → json", () => {
    const value = inferArtifactValue("x", true, undefined);
    expect(value).toEqual({ kind: "json", data: true });
  });

  it("array → json", () => {
    const value = inferArtifactValue("x", [1, 2, 3], undefined);
    expect(value).toEqual({ kind: "json", data: [1, 2, 3] });
  });

  it("string + no extension + no mimeType → json", () => {
    const value = inferArtifactValue("note", "hello", undefined);
    expect(value).toEqual({ kind: "json", data: "hello" });
  });

  it("string + extension → file", () => {
    const value = inferArtifactValue("doc.md", "# title", undefined);
    expect(value.kind).toBe("file");
    if (value.kind !== "file") return;
    expect(value.mimeType).toBe("text/markdown");
  });

  it("string + explicit mimeType → file", () => {
    const value = inferArtifactValue("untitled", "raw", "text/plain");
    expect(value.kind).toBe("file");
    if (value.kind !== "file") return;
    expect(value.mimeType).toBe("text/plain");
  });

  it("file with unknown extension → file with octet-stream", () => {
    const value = inferArtifactValue("blob.xyz", "data", undefined);
    expect(value.kind).toBe("file");
    if (value.kind !== "file") return;
    expect(value.mimeType).toBe("application/octet-stream");
  });

  it("explicit mimeType overrides extension inference", () => {
    const value = inferArtifactValue("page.html", "raw", "text/plain");
    expect(value.kind).toBe("file");
    if (value.kind !== "file") return;
    expect(value.mimeType).toBe("text/plain");
  });
});
