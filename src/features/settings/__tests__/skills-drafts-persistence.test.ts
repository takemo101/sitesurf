import { describe, expect, it } from "vitest";

import { InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import type { StoredSkillDraft } from "@/shared/skill-draft-types";
import type { Skill } from "@/shared/skill-types";

import { loadSkillDrafts, saveSkillDrafts } from "../skills-drafts-persistence";

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

function createDraft(overrides: Partial<StoredSkillDraft> = {}): StoredSkillDraft {
  return {
    draftId: "draft-1",
    normalizedSkill: createSkill(),
    validation: {
      status: "warning",
      errors: [],
      warnings: [{ type: "quality", message: "description is too short" }],
    },
    suggestedFixes: ["説明文をより具体的にしてください。"],
    source: "chat",
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("skills-drafts-persistence", () => {
  it("loads drafts from storage", async () => {
    const storage = new InMemoryStorage();
    await storage.set("sitesurf_skill_drafts", [createDraft()]);

    const drafts = await loadSkillDrafts(storage);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].draftId).toBe("draft-1");
    expect(drafts[0].validation.status).toBe("warning");
  });

  it("returns an empty array when no drafts are stored", async () => {
    const storage = new InMemoryStorage();

    await expect(loadSkillDrafts(storage)).resolves.toEqual([]);
  });

  it("saves drafts verbatim for later approval", async () => {
    const storage = new InMemoryStorage();
    const draft = createDraft({ validation: { status: "reject", errors: [], warnings: [] } });

    await saveSkillDrafts(storage, [draft]);

    const stored = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
    expect(stored).toEqual([draft]);
  });
});
