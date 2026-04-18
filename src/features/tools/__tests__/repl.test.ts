import { describe, expect, it } from "vitest";
import { buildReplToolDef } from "../repl";

describe("buildReplToolDef", () => {
  it("COMMON_PATTERNS をデフォルトでは含めない", () => {
    const def = buildReplToolDef({ enableBgFetch: true });

    expect(def.description).not.toContain("# Common Patterns");
    expect(def.description).toContain("# Tool Philosophy");
    expect(def.description).toContain("# Available Functions");
  });

  it("includeCommonPatterns=true の時だけ COMMON_PATTERNS を含める", () => {
    const def = buildReplToolDef({
      enableBgFetch: true,
      includeCommonPatterns: true,
    });

    expect(def.description).toContain("# Common Patterns");
    expect(def.description).toContain("Research & Document");
  });
});
