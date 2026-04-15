import { describe, expect, it } from "vitest";

import type { Skill } from "@/shared/skill-types";

import {
  canUpsertStoredSkill,
  getSkillListItemKey,
  tryUpsertStoredSkill,
  upsertStoredSkill,
} from "../skills-editor-state";

function createSkill(): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "A test skill",
    matchers: { hosts: ["example.com"] },
    version: "1.0.0",
    extractors: [
      {
        id: "getTitle",
        name: "Get Title",
        description: "Get page title",
        code: "function () { return document.title; }",
        outputSchema: "string",
      },
    ],
  };
}

describe("skills-editor-state", () => {
  it("stores canonical markdown in local state after save", () => {
    const updated = upsertStoredSkill(
      [
        {
          skill: createSkill(),
          markdown: "legacy markdown",
        },
      ],
      createSkill(),
      "test-skill",
    );

    expect(updated[0].markdown).toContain("<!-- extractor-id: getTitle -->");
    expect(updated[0].markdown).toContain("<!-- output-schema: string -->");
  });

  it("rejects renaming to an existing skill id", () => {
    const conflict = canUpsertStoredSkill(
      [
        { skill: createSkill(), markdown: "" },
        { skill: { ...createSkill(), id: "other-skill", name: "Other Skill" }, markdown: "" },
      ],
      { ...createSkill(), id: "other-skill", name: "Other Skill" },
      "test-skill",
    );

    expect(conflict).toContain("already exists");
  });

  it("returns a failed result instead of mutating when duplicate id exists", () => {
    const result = tryUpsertStoredSkill(
      [
        { skill: createSkill(), markdown: "" },
        { skill: { ...createSkill(), id: "other-skill", name: "Other Skill" }, markdown: "" },
      ],
      { ...createSkill(), id: "other-skill", name: "Other Skill" },
      "test-skill",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("already exists");
  });

  it("rejects creating a new custom skill with an existing custom id", () => {
    const result = tryUpsertStoredSkill(
      [{ skill: createSkill(), markdown: "" }],
      createSkill(),
      null,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("already exists");
  });

  it("rejects ids reserved by built-in skills", () => {
    const result = tryUpsertStoredSkill([], createSkill(), null, ["test-skill"]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("already exists");
  });

  it("creates distinct list keys for built-in and custom skills with same id", () => {
    expect(getSkillListItemKey("shared-skill", true)).toBe("builtin:shared-skill");
    expect(getSkillListItemKey("shared-skill", false)).toBe("custom:shared-skill");
  });
});
