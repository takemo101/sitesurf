import { describe, expect, it } from "vitest";

import { buildSkillDraftPreview } from "../skill-draft-preview";
import type { StoredSkillDraft } from "../skill-draft-types";

function createDraft(): StoredSkillDraft {
  return {
    draftId: "draft-1",
    normalizedSkill: {
      id: "draft-skill",
      name: "Draft Skill",
      description: "Preview this skill before approval",
      scope: "site",
      matchers: { hosts: ["example.com"], paths: ["/products/*"] },
      version: "0.0.0",
      extractors: [
        {
          id: "getTitle",
          name: "Get Title",
          description: "Read the page title",
          code: "function () { return document.title; }",
          outputSchema: "string",
        },
      ],
    },
    validation: { status: "ok", errors: [], warnings: [] },
    suggestedFixes: [],
    source: "chat",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
  };
}

describe("buildSkillDraftPreview", () => {
  it("includes extractor code so approval can review the actual implementation", () => {
    const preview = buildSkillDraftPreview(createDraft());

    expect(preview).toContain("function () { return document.title; }");
    expect(preview).toContain("getTitle");
    expect(preview).toContain("example.com");
  });
});
