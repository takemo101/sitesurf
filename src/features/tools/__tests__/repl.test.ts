import { describe, expect, it } from "vitest";
import { buildReplToolDef } from "../repl";

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
