import { describe, expect, it } from "vitest";

import type { StoredSkillDraft } from "@/shared/skill-draft-types";
import type { Skill } from "@/shared/skill-types";

import { approveSkillDraft, discardSkillDraft } from "../skills-drafts-state";

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "draft-skill",
    name: "Draft Skill",
    description: "A draft skill",
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
    ...overrides,
  };
}

function createDraft(overrides: Partial<StoredSkillDraft> = {}): StoredSkillDraft {
  return {
    draftId: "draft-1",
    normalizedSkill: createSkill(),
    validation: { status: "ok", errors: [], warnings: [] },
    suggestedFixes: [],
    source: "chat",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("skills-drafts-state", () => {
  it("approves a draft by moving it into stored skills", () => {
    const result = approveSkillDraft([], [createDraft()], "draft-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updatedSkills).toHaveLength(1);
    expect(result.updatedSkills[0].skill.id).toBe("draft-skill");
    expect(result.remainingDrafts).toEqual([]);
  });

  it("rejects approval when the draft validation status is reject", () => {
    const result = approveSkillDraft(
      [],
      [createDraft({ validation: { status: "reject", errors: [], warnings: [] } })],
      "draft-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("validation");
  });

  it("rejects approval when extractor code is a bare body", () => {
    const result = approveSkillDraft(
      [],
      [
        createDraft({
          normalizedSkill: createSkill({
            extractors: [
              {
                id: "getTitle",
                name: "Get Title",
                description: "Get page title",
                code: "return document.title;",
                outputSchema: "string",
              },
            ],
          }),
          validation: { status: "ok", errors: [], warnings: [] },
        }),
      ],
      "draft-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("full function source");
  });

  it("revalidates the normalized skill during approval", () => {
    const result = approveSkillDraft(
      [],
      [
        createDraft({
          normalizedSkill: createSkill({
            extractors: [
              {
                id: "goSomewhere",
                name: "Go Somewhere",
                description: "Navigate away from the page",
                code: 'window.location.assign("https://example.com")',
                outputSchema: "string",
              },
            ],
          }),
          validation: { status: "ok", errors: [], warnings: [] },
        }),
      ],
      "draft-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Forbidden navigation pattern");
  });

  it("rejects approval when a draft tries to overwrite an existing custom skill id", () => {
    const result = approveSkillDraft(
      [{ skill: createSkill(), markdown: "" }],
      [createDraft()],
      "draft-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("already exists");
  });

  it("rejects approval when the normalized skill is structurally invalid", () => {
    const result = approveSkillDraft(
      [],
      [
        createDraft({
          normalizedSkill: createSkill({
            name: "",
            matchers: { hosts: [] },
            extractors: [],
          }),
          validation: { status: "ok", errors: [], warnings: [] },
        }),
      ],
      "draft-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Skill name is required");
  });

  it("returns an error instead of throwing when the persisted draft envelope is malformed", () => {
    const malformedDraft = {
      draftId: "draft-1",
      normalizedSkill: null,
      validation: null,
      suggestedFixes: [],
      source: "chat",
      createdAt: "2026-04-12T00:00:00.000Z",
      updatedAt: "2026-04-12T00:00:00.000Z",
    } as unknown as StoredSkillDraft;

    expect(() => approveSkillDraft([], [malformedDraft], "draft-1")).not.toThrow();

    const result = approveSkillDraft([], [malformedDraft], "draft-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("draft");
  });

  it("discards only the targeted draft", () => {
    const drafts = [createDraft(), createDraft({ draftId: "draft-2" })];

    const remaining = discardSkillDraft(drafts, "draft-1");

    expect(remaining).toHaveLength(1);
    expect(remaining[0].draftId).toBe("draft-2");
  });
});
