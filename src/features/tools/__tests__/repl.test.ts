import { describe, expect, it } from "vitest";
import { buildReplToolDef, isFileSaveAction } from "../repl";

describe("buildReplToolDef", () => {
  it("COMMON_PATTERNS をデフォルトでは含めない", () => {
    const def = buildReplToolDef({ enableBgFetch: true });

    expect(def.description).not.toContain("# Common Patterns");
    expect(def.description).toContain("# Available Functions");
    expect(def.description).not.toContain("# Tool Philosophy");
  });

  it("includeCommonPatterns=true の時だけ COMMON_PATTERNS を含める", () => {
    const def = buildReplToolDef({
      enableBgFetch: true,
      includeCommonPatterns: true,
    });

    expect(def.description).toContain("# Common Patterns");
    expect(def.description).toContain("Research & Document");
  });

  it("ページ読取を readPage() helper として案内し、top-level read_page を案内しない", () => {
    const def = buildReplToolDef({ enableBgFetch: true });

    expect(def.description).toContain("readPage(maxDepth?)");
    expect(def.description).not.toContain("top-level `read_page`");
  });

  it("skills guidance uses runtime-injected window extractors", () => {
    const def = buildReplToolDef({ enableBgFetch: true });

    expect(def.description).toContain("window.youtube.getVideoInfo()");
    expect(def.description).not.toContain("new Function(`return (${code})`)()");
  });
});

describe("isFileSaveAction", () => {
  it("returnFile は常に true", () => {
    expect(isFileSaveAction("returnFile", { success: true })).toBe(true);
    expect(isFileSaveAction("returnFile", null)).toBe(true);
  });

  it("saveArtifact + kind:file は true", () => {
    expect(isFileSaveAction("saveArtifact", { success: true, name: "x.html", kind: "file" })).toBe(
      true,
    );
  });

  it("saveArtifact + kind:json は false", () => {
    expect(isFileSaveAction("saveArtifact", { success: true, name: "data", kind: "json" })).toBe(
      false,
    );
  });

  it("saveArtifact で result が不正な形でも false (throw しない)", () => {
    expect(isFileSaveAction("saveArtifact", null)).toBe(false);
    expect(isFileSaveAction("saveArtifact", "unexpected")).toBe(false);
    expect(isFileSaveAction("saveArtifact", {})).toBe(false);
  });

  it("関係ない action は false", () => {
    expect(isFileSaveAction("getArtifact", { kind: "file" })).toBe(false);
    expect(isFileSaveAction("listArtifacts", [])).toBe(false);
    expect(isFileSaveAction("createOrUpdateArtifact", { success: true })).toBe(false);
  });
});
