import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("settings feature architecture", () => {
  it("does not import features/tools directly from SkillsEditor", () => {
    const content = readFileSync(
      join(projectRoot, "src/features/settings/SkillsEditor.tsx"),
      "utf8",
    );

    expect(content).not.toContain('from "@/features/tools');
  });

  it("does not import features/tools directly from skills-drafts-state", () => {
    const content = readFileSync(
      join(projectRoot, "src/features/settings/skills-drafts-state.ts"),
      "utf8",
    );

    expect(content).not.toContain('from "@/features/tools');
  });
});
