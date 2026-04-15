import { describe, expect, it } from "vitest";
import {
  executeSkill,
  skillToolDef,
  listSkillDraftsToolDef,
  createSkillDraftToolDef,
  updateSkillDraftToolDef,
  deleteSkillDraftToolDef,
  executeListSkillDrafts,
  executeCreateSkillDraft,
  executeUpdateSkillDraft,
  executeDeleteSkillDraft,
  type SkillListResult,
  type SkillGetResult,
  type SkillCreateResult,
  type SkillUpdateResult,
  type SkillDeleteResult,
  type CreateSkillDraftResult,
  type UpdateSkillDraftResult,
  type ListSkillDraftsResult,
  type DeleteSkillDraftResult,
} from "../skill";
import { SkillRegistry } from "../skills";
import { InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import { saveCustomSkills } from "@/features/settings/skills-persistence";
import { approveSkillDraft } from "@/features/settings/skills-drafts-state";
import type { Skill } from "@/shared/skill-types";
import type { StoredSkillDraft } from "@/shared/skill-draft-types";
import { loadSkillRegistry } from "../skills/skill-loader";

function createTestSkill(overrides: Partial<Skill> = {}): Skill {
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
    ...overrides,
  };
}

describe("skill tool", () => {
  describe("tool definition", () => {
    it("has correct name", () => {
      expect(skillToolDef.name).toBe("skill");
    });

    it("has description with all actions", () => {
      expect(skillToolDef.description).toContain("list");
      expect(skillToolDef.description).toContain("get");
      expect(skillToolDef.description).toContain("create");
      expect(skillToolDef.description).toContain("update");
      expect(skillToolDef.description).toContain("patch");
      expect(skillToolDef.description).toContain("delete");
    });

    it("has parameters with action enum", () => {
      const params = skillToolDef.parameters as Record<string, unknown>;
      expect(params.type).toBe("object");
      expect(params.properties).toHaveProperty("action");
    });
  });

  describe("create_skill_draft tool definition", () => {
    it("has the expected tool name", () => {
      expect(createSkillDraftToolDef.name).toBe("create_skill_draft");
    });

    it("describes draft persistence without claiming custom-skill save", () => {
      expect(createSkillDraftToolDef.description).toContain("下書きとして保存");
      expect(createSkillDraftToolDef.description).toContain("custom skill としては保存されません");
    });

    it("accepts draft creation inputs", () => {
      const params = createSkillDraftToolDef.parameters as Record<string, unknown>;
      expect(params.type).toBe("object");
      expect(params.properties).toHaveProperty("name");
      expect(params.properties).toHaveProperty("extractors");
    });
  });

  describe("list action", () => {
    it("returns all skills when url is empty", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ id: "skill1", name: "Skill 1" }));
      registry.register(createTestSkill({ id: "skill2", name: "Skill 2" }));

      const result = await executeSkill(storage, registry, undefined, { action: "list", url: "" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillListResult;
      expect(value.skills).toHaveLength(2);
      expect(value.skills[0].id).toBe("skill1");
      expect(value.skills[1].id).toBe("skill2");
    });

    it("returns matching skills for url", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ id: "youtube", matchers: { hosts: ["youtube.com"] } }));
      registry.register(createTestSkill({ id: "google", matchers: { hosts: ["google.com"] } }));

      const result = await executeSkill(storage, registry, undefined, {
        action: "list",
        url: "https://youtube.com/watch",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillListResult;
      expect(value.skills).toHaveLength(1);
      expect(value.skills[0].id).toBe("youtube");
    });

    it("includes global skills when listing with a URL that has no site match", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(
        createTestSkill({
          id: "dom-mutation",
          name: "DOM Mutation",
          scope: "global",
          matchers: { hosts: [] },
        }),
      );
      registry.register(createTestSkill({ id: "youtube", matchers: { hosts: ["youtube.com"] } }));

      const result = await executeSkill(storage, registry, "https://zenn.dev/articles/123", {
        action: "list",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillListResult;
      expect(value.skills).toHaveLength(1);
      expect(value.skills[0].id).toBe("dom-mutation");
      expect(value.skills[0].scope).toBe("global");
    });

    it("includes global skills alongside site-matched skills", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(
        createTestSkill({
          id: "dom-mutation",
          name: "DOM Mutation",
          scope: "global",
          matchers: { hosts: [] },
        }),
      );
      registry.register(createTestSkill({ id: "youtube", matchers: { hosts: ["youtube.com"] } }));

      const result = await executeSkill(storage, registry, "https://youtube.com/watch", {
        action: "list",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillListResult;
      expect(value.skills).toHaveLength(2);
      const ids = value.skills.map((s) => s.id);
      expect(ids).toContain("dom-mutation");
      expect(ids).toContain("youtube");
    });

    it("uses currentUrl when url is undefined", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ id: "example", matchers: { hosts: ["example.com"] } }));

      const result = await executeSkill(storage, registry, "https://example.com/page", {
        action: "list",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillListResult;
      expect(value.skills).toHaveLength(1);
    });

    it("excludes extractor code from list result", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, { action: "list", url: "" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillListResult;
      const skill = value.skills[0];
      expect(skill).toHaveProperty("id");
      expect(skill).toHaveProperty("name");
      expect(skill).toHaveProperty("description");
      expect(skill).toHaveProperty("matchers");
      expect(skill).toHaveProperty("extractors");
      // extractors should not have code
      expect(skill.extractors[0]).not.toHaveProperty("code");
      expect(skill.extractors[0]).toHaveProperty("id");
      expect(skill.extractors[0]).toHaveProperty("name");
      expect(skill.extractors[0]).toHaveProperty("description");
      expect(skill.extractors[0]).toHaveProperty("outputSchema");
    });
  });

  describe("get action", () => {
    it("returns skill by id without code by default", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "get",
        id: "test-skill",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillGetResult;
      expect(value.skill.id).toBe("test-skill");
      expect(value.skill.extractors[0].code).toBe("");
    });

    it("returns skill with code when includeLibraryCode is true", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "get",
        id: "test-skill",
        includeLibraryCode: true,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillGetResult;
      expect(value.skill.extractors[0].code).toBe("function () { return document.title; }");
    });

    it("returns error for non-existent skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "get",
        id: "non-existent",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });

    it("rejects renaming to an existing skill id", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());
      registry.register(createTestSkill({ id: "other-skill", name: "Other Skill" }));

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: { id: "other-skill", name: "Other Skill" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("already exists");
    });

    it("rejects bare extractor bodies on update", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: {
          extractors: [
            {
              id: "getTitle",
              name: "Get Title",
              description: "Get page title",
              code: "return document.title;",
              outputSchema: "string",
            },
          ],
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("full function source");
    });
  });

  describe("create action", () => {
    it("creates a new skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const skill = createTestSkill({ id: "new-skill" });

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: skill,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillCreateResult;
      expect(value.skill.id).toBe("new-skill");
      expect(registry.get("new-skill")).toBeDefined();
    });

    it("persists only custom skills, not builtin registry entries", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ id: "builtin-skill", name: "Builtin Skill" }));

      await storage.set("sitesurf_custom_skills", [
        {
          skill: createTestSkill({ id: "custom-skill", name: "Custom Skill" }),
          markdown:
            "---\nid: custom-skill\nname: Custom Skill\nhosts:\n  - example.com\n---\n\n## getTitle\n\n```js\nreturn document.title;\n```",
        },
      ]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({ id: "new-custom-skill", name: "New Custom Skill" }),
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.map((entry) => entry.skill.id)).toEqual(["custom-skill", "new-custom-skill"]);
    });

    it("migrates legacy Skill[] storage when creating a new custom skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      await storage.set("sitesurf_custom_skills", [createTestSkill({ id: "legacy-skill" })]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({ id: "new-custom-skill", name: "New Custom Skill" }),
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.map((entry) => entry.skill.id)).toEqual(["legacy-skill", "new-custom-skill"]);
    });

    it("migrates legacy tandemweb_custom_skills when creating a new custom skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      await storage.set("tandemweb_custom_skills", [createTestSkill({ id: "legacy-skill" })]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({ id: "new-custom-skill", name: "New Custom Skill" }),
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.map((entry) => entry.skill.id)).toEqual(["legacy-skill", "new-custom-skill"]);
      expect(await storage.get("tandemweb_custom_skills")).toBeNull();
    });

    it("merges sitesurf and tandemweb custom skill keys when both exist", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      await storage.set("sitesurf_custom_skills", [
        {
          skill: createTestSkill({ id: "sitesurf-skill" }),
          markdown: "sitesurf-markdown",
        },
      ]);
      await storage.set("tandemweb_custom_skills", [createTestSkill({ id: "legacy-skill" })]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({ id: "new-custom-skill", name: "New Custom Skill" }),
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.map((entry) => entry.skill.id).sort()).toEqual([
        "legacy-skill",
        "new-custom-skill",
        "sitesurf-skill",
      ]);
    });

    it("returns error for duplicate id", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill(),
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("already exists");
    });

    it("validates required fields", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: { ...createTestSkill(), id: "" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("required");
    });

    it("rejects dangerous extractor code on create", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({
          id: "dangerous",
          extractors: [
            {
              id: "redirect",
              name: "Redirect",
              description: "redirect",
              code: 'location.assign("https://example.com")',
              outputSchema: "string",
            },
          ],
        }),
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("location.assign()");
    });

    it("rejects duplicate host matchers on create", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({
          matchers: { hosts: ["example.com", "example.com"] },
        }),
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("duplicate host matcher");
    });

    it("rejects duplicate extractor ids on create", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({
          extractors: [
            createTestSkill().extractors[0],
            {
              ...createTestSkill().extractors[0],
              name: "Get Title Again",
              description: "duplicate id",
              code: "function () { return document.title; }",
            },
          ],
        }),
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("duplicate extractor id");
    });

    it("rejects bare extractor bodies on create", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({
          id: "bare-body-skill",
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
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("full function source");
    });

    it("allows global skills without hosts on create", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "create",
        data: createTestSkill({
          id: "global-skill",
          scope: "global",
          matchers: { hosts: [] },
        }),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect((result.value as SkillCreateResult).skill.scope).toBe("global");
    });
  });

  describe("create_skill_draft tool", () => {
    it("creates a draft without persisting it as a custom skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Example Draft Skill",
        description: "Extracts a page title from the current site",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the page title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const value = result.value as CreateSkillDraftResult;
      expect(value.draftId).toBeTruthy();
      expect(value.normalizedSkill.id).toBe("example-draft-skill");
      expect(value.validation.status).toBe("ok");

      const storedDrafts = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts?.[0].normalizedSkill.id).toBe("example-draft-skill");

      const storedSkills =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(storedSkills).toBeNull();
      expect(registry.get("example-draft-skill")).toBeUndefined();
    });

    it("returns reject validation for dangerous extractor code", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Unsafe Draft",
        description: "Attempts unsafe navigation",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "goSomewhere",
            name: "Go Somewhere",
            description: "Navigate away",
            code: 'window.location.href = "https://danger.example";',
            outputSchema: "string",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const value = result.value as CreateSkillDraftResult;
      expect(value.validation.status).toBe("reject");
      expect(value.validation.errors[0]?.message).toContain("Forbidden navigation pattern");
      expect(value.suggestedFixes).toContain(
        "window.location や navigate() は使わず、必要なら navigate ツールへ責務を分離してください。",
      );
    });

    it("warns when the generated skill id conflicts with an existing skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ id: "example-draft-skill", name: "Existing Skill" }));

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Example Draft Skill",
        description: "Extracts a page title from the current site",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the page title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const value = result.value as CreateSkillDraftResult;
      expect(value.validation.status).toBe("reject");
      expect(
        value.validation.errors.some((error) => error.message.includes("already exists")),
      ).toBe(true);
    });

    it("rejects drafts that are structurally invalid even if dangerous-code validation passes", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "   ",
        description: "This draft is missing required fields after normalization",
        scope: "site",
        matchers: { hosts: [] },
        extractors: [],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.validation.status).toBe("reject");
      expect(result.value.validation.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining([
          "Skill name is required",
          "Skill matchers.hosts is required and must not be empty",
          "Skill extractors is required and must have at least one extractor",
        ]),
      );
    });

    it("returns a tool error for malformed draft tool input", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Broken Draft",
        description: "Malformed extractor payload should not throw",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: null,
      } as unknown as Parameters<typeof executeCreateSkillDraft>[2]);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("extractors");
    });

    it("returns a tool error when matcher arrays contain non-string values", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Broken Matchers",
        description: "Malformed matcher arrays should not throw",
        scope: "site",
        matchers: {
          hosts: ["example.com"],
          paths: ["/ok", 1] as unknown as string[],
        },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("matchers.paths");
    });

    it("approved drafts become available through the existing skill registry flow", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Approved Draft Skill",
        description: "Extract the title for approved skill flow",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the page title from the current site",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const drafts = (await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts")) ?? [];
      const approval = approveSkillDraft([], drafts, result.value.draftId);
      expect(approval.ok).toBe(true);
      if (!approval.ok) return;

      await saveCustomSkills(storage, approval.updatedSkills);
      await storage.set("sitesurf_skill_drafts", approval.remainingDrafts);

      const loadedRegistry = await loadSkillRegistry(storage);
      const matches = loadedRegistry.getAvailableSkills("https://example.com/article");
      expect(matches.some((match) => match.skill.id === "approved-draft-skill")).toBe(true);
    });
  });

  describe("list_skill_drafts tool definition", () => {
    it("has the expected tool name", () => {
      expect(listSkillDraftsToolDef.name).toBe("list_skill_drafts");
    });
  });

  describe("list_skill_drafts tool", () => {
    it("returns empty array when no drafts exist", async () => {
      const storage = new InMemoryStorage();

      const result = await executeListSkillDrafts(storage);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as ListSkillDraftsResult;
      expect(value.drafts).toEqual([]);
    });

    it("returns all pending drafts with summary fields", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      await executeCreateSkillDraft(storage, registry, {
        name: "Draft One",
        description: "First draft",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the page title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      await executeCreateSkillDraft(storage, registry, {
        name: "Draft Two",
        description: "Second draft",
        scope: "global",
        matchers: { hosts: ["*"] },
        extractors: [
          {
            id: "getUrl",
            name: "Get URL",
            description: "Return the page URL",
            code: "function () { return location.href; }",
            outputSchema: "string",
          },
        ],
      });

      const result = await executeListSkillDrafts(storage);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as ListSkillDraftsResult;
      expect(value.drafts).toHaveLength(2);
      expect(value.drafts[0].name).toBe("Draft One");
      expect(value.drafts[0].skillId).toBe("draft-one");
      expect(value.drafts[0].draftId).toBeTruthy();
      expect(value.drafts[0].validation.status).toBe("ok");
      expect(value.drafts[0].suggestedFixes).toEqual(expect.any(Array));
      expect(value.drafts[1].name).toBe("Draft Two");
      expect(value.drafts[1].scope).toBe("global");
    });
  });

  describe("update_skill_draft tool definition", () => {
    it("has the expected tool name", () => {
      expect(updateSkillDraftToolDef.name).toBe("update_skill_draft");
    });

    it("requires draftId and updates parameters", () => {
      const params = updateSkillDraftToolDef.parameters as Record<string, unknown>;
      expect(params.required).toEqual(["draftId", "updates"]);
    });
  });

  describe("update_skill_draft tool", () => {
    async function createDraft(storage: InMemoryStorage, registry: SkillRegistry) {
      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Draft To Update",
        description: "Original description for update test",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the page title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("setup failed");
      return result.value as CreateSkillDraftResult;
    }

    it("updates description of an existing draft", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: { description: "Improved description" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as UpdateSkillDraftResult;
      expect(value.draftId).toBe(draft.draftId);
      expect(value.normalizedSkill.description).toBe("Improved description");
      expect(value.normalizedSkill.name).toBe("Draft To Update");
    });

    it("updates extractors of an existing draft", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: {
          extractors: [
            {
              id: "getHeading",
              name: "Get Heading",
              description: "Return the h1 text from the page",
              code: "function () { return document.querySelector('h1')?.textContent; }",
              outputSchema: "string",
            },
          ],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as UpdateSkillDraftResult;
      expect(value.normalizedSkill.extractors).toHaveLength(1);
      expect(value.normalizedSkill.extractors[0].id).toBe("getHeading");
    });

    it("persists the updated draft in storage", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: { description: "Persisted description" },
      });

      const storedDrafts = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts?.[0].normalizedSkill.description).toBe("Persisted description");
      expect(storedDrafts?.[0].draftId).toBe(draft.draftId);
    });

    it("re-validates after update and returns reject for dangerous code", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: {
          extractors: [
            {
              id: "goSomewhere",
              name: "Go Somewhere",
              description: "Navigate away from the page",
              code: 'window.location.href = "https://danger.example";',
              outputSchema: "string",
            },
          ],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as UpdateSkillDraftResult;
      expect(value.validation.status).toBe("reject");
      expect(value.validation.errors[0]?.message).toContain("Forbidden navigation pattern");
    });

    it("returns error when draft is not found", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: "non-existent-id",
        updates: { description: "Should fail" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Draft not found");
    });

    it("returns error for empty draftId", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: "",
        updates: { description: "Should fail" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("draftId must be a non-empty string");
    });

    it("returns error for malformed updates", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: "some-id",
        updates: null,
      } as unknown as Parameters<typeof executeUpdateSkillDraft>[2]);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("updates must be an object");
    });

    it("preserves createdAt and sets updatedAt on update", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      const draftsBefore = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
      const createdAt = draftsBefore?.[0].createdAt;
      const updatedAtBefore = draftsBefore?.[0].updatedAt;
      expect(createdAt).toBe(updatedAtBefore);

      // Wait 1ms to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2));

      await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: { description: "Updated" },
      });

      const draftsAfter = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
      expect(draftsAfter?.[0].createdAt).toBe(createdAt);
      expect(draftsAfter?.[0].updatedAt).not.toBe(updatedAtBefore);
    });

    it("updated draft can still be approved", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: { description: "Better description for approval" },
      });

      const drafts = (await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts")) ?? [];
      const approval = approveSkillDraft([], drafts, draft.draftId);
      expect(approval.ok).toBe(true);
      if (!approval.ok) return;

      await saveCustomSkills(storage, approval.updatedSkills);
      await storage.set("sitesurf_skill_drafts", approval.remainingDrafts);

      const loadedRegistry = await loadSkillRegistry(storage);
      const skill = loadedRegistry.get("draft-to-update");
      expect(skill?.description).toBe("Better description for approval");
    });

    it("does not corrupt other drafts when updating one", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const draft1 = await createDraft(storage, registry);

      const result2 = await executeCreateSkillDraft(storage, registry, {
        name: "Second Draft",
        description: "Another draft",
        scope: "site",
        matchers: { hosts: ["other.com"] },
        extractors: [
          {
            id: "getUrl",
            name: "Get URL",
            description: "Return the page URL",
            code: "function () { return location.href; }",
            outputSchema: "string",
          },
        ],
      });
      expect(result2.ok).toBe(true);
      if (!result2.ok) return;
      const draft2 = result2.value as CreateSkillDraftResult;

      await executeUpdateSkillDraft(storage, registry, {
        draftId: draft1.draftId,
        updates: { description: "Updated first" },
      });

      const storedDrafts = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
      expect(storedDrafts).toHaveLength(2);
      expect(
        storedDrafts?.find((d) => d.draftId === draft1.draftId)?.normalizedSkill.description,
      ).toBe("Updated first");
      expect(
        storedDrafts?.find((d) => d.draftId === draft2.draftId)?.normalizedSkill.description,
      ).toBe("Another draft");
    });

    it("detects skill id conflict with another pending draft on create", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      await executeCreateSkillDraft(storage, registry, {
        name: "Duplicate Name",
        description: "First draft with this name",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Duplicate Name",
        description: "Second draft with same name",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as CreateSkillDraftResult;
      expect(value.validation.status).toBe("reject");
      expect(value.validation.errors.some((e) => e.message.includes("Another draft"))).toBe(true);
    });

    it("does not flag own skill id as conflict on update", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      const result = await executeUpdateSkillDraft(storage, registry, {
        draftId: draft.draftId,
        updates: { description: "Just changing description, same name" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as UpdateSkillDraftResult;
      expect(value.validation.errors.some((e) => e.message.includes("Another draft"))).toBe(false);
    });
  });

  describe("delete_skill_draft tool definition", () => {
    it("has the expected tool name", () => {
      expect(deleteSkillDraftToolDef.name).toBe("delete_skill_draft");
    });

    it("requires draftId parameter", () => {
      const params = deleteSkillDraftToolDef.parameters as Record<string, unknown>;
      expect(params.required).toEqual(["draftId"]);
    });
  });

  describe("delete_skill_draft tool", () => {
    async function createDraft(storage: InMemoryStorage, registry: SkillRegistry) {
      const result = await executeCreateSkillDraft(storage, registry, {
        name: "Draft To Delete",
        description: "Original description for delete test",
        scope: "site",
        matchers: { hosts: ["example.com"] },
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Return the page title",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("setup failed");
      return result.value as CreateSkillDraftResult;
    }

    it("deletes an existing draft", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft = await createDraft(storage, registry);

      const result = await executeDeleteSkillDraft(storage, {
        draftId: draft.draftId,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as DeleteSkillDraftResult;
      expect(value.deleted).toBe(true);
      expect(value.draftId).toBe(draft.draftId);
    });

    it("removes the deleted draft from storage without affecting others", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const draft1 = await createDraft(storage, registry);
      const draft2 = await executeCreateSkillDraft(storage, registry, {
        name: "Second Draft To Keep",
        description: "Should remain after delete",
        scope: "site",
        matchers: { hosts: ["other.com"] },
        extractors: [
          {
            id: "getUrl",
            name: "Get Url",
            description: "Return the page URL",
            code: "function () { return location.href; }",
            outputSchema: "string",
          },
        ],
      });
      expect(draft2.ok).toBe(true);
      if (!draft2.ok) return;

      await executeDeleteSkillDraft(storage, { draftId: draft1.draftId });

      const storedDrafts = await storage.get<StoredSkillDraft[]>("sitesurf_skill_drafts");
      expect(storedDrafts).toHaveLength(1);
      expect(storedDrafts?.[0].draftId).toBe(draft2.value.draftId);
    });

    it("returns error when draft is not found", async () => {
      const storage = new InMemoryStorage();

      const result = await executeDeleteSkillDraft(storage, { draftId: "non-existent-id" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Draft not found");
    });

    it("returns error for empty draftId", async () => {
      const storage = new InMemoryStorage();

      const result = await executeDeleteSkillDraft(storage, { draftId: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("draftId must be a non-empty string");
    });

    it("returns tool error instead of throwing for malformed args", async () => {
      const storage = new InMemoryStorage();

      await expect(
        executeDeleteSkillDraft(
          storage,
          null as unknown as Parameters<typeof executeDeleteSkillDraft>[1],
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { message: "delete_skill_draft arguments must be an object" },
      });
    });
  });

  describe("update action", () => {
    it("updates skill fields", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: { description: "Updated description" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillUpdateResult;
      expect(value.skill.description).toBe("Updated description");
      expect(registry.get("test-skill")?.description).toBe("Updated description");
    });

    it("keeps updated description after markdown round-trip", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      await storage.set("sitesurf_custom_skills", [
        {
          skill: createTestSkill(),
          markdown:
            "---\nid: test-skill\nname: Test Skill\ndescription: A test skill\nhosts:\n  - example.com\nversion: 1.0.0\n---\n\n## Get Title\nGet page title\n```js\nreturn document.title;\n```",
        },
      ]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: { description: "Updated description" },
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.[0].markdown).toContain("description: Updated description");
      expect(stored?.[0].markdown).toContain("<!-- extractor-id: getTitle -->");
      expect(stored?.[0].markdown).toContain("<!-- output-schema: string -->");
    });

    it("renames custom skill id without leaving stale old id in storage", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      await storage.set("sitesurf_custom_skills", [
        {
          skill: createTestSkill(),
          markdown:
            "---\nid: test-skill\nname: Test Skill\nhosts:\n  - example.com\n---\n\n## getTitle\n\n```js\nreturn document.title;\n```",
        },
      ]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: { id: "renamed-skill", name: "Renamed Skill" },
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.map((entry) => entry.skill.id)).toEqual(["renamed-skill"]);
    });

    it("preserves markdown when renaming a custom skill id", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const markdown =
        "---\nid: test-skill\nname: Test Skill\nhosts:\n  - example.com\n---\n\n## getTitle\n\n```js\nreturn document.title;\n```";
      await storage.set("sitesurf_custom_skills", [
        {
          skill: createTestSkill(),
          markdown,
        },
      ]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: { id: "renamed-skill", name: "Renamed Skill" },
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.[0].markdown).toContain("id: renamed-skill");
      expect(stored?.[0].markdown).toContain("name: Renamed Skill");
      expect(stored?.[0].markdown).not.toContain("id: test-skill");
    });

    it("returns error for non-existent skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "non-existent",
        updates: { description: "New" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });

    it("validates updated skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: { name: "" },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("required");
    });

    it("rejects dangerous extractor code on update", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "update",
        id: "test-skill",
        updates: {
          extractors: [
            {
              id: "getTitle",
              name: "Get Title",
              description: "Get page title",
              code: 'window.location.pathname = "/next";',
              outputSchema: "string",
            },
          ],
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("window.location.pathname assignment");
    });
  });

  describe("patch action", () => {
    it("patches string fields", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "test-skill",
        patches: {
          description: {
            old_string: "A test skill",
            new_string: "An updated test skill",
          },
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillUpdateResult;
      expect(value.skill.description).toBe("An updated test skill");
    });

    it("patches extractor code", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "test-skill",
        patches: {
          "extractors.getTitle.code": {
            old_string: "function () { return document.title; }",
            new_string: "function () { return document.querySelector('h1')?.textContent; }",
          },
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillUpdateResult;
      expect(value.skill.extractors[0].code).toBe(
        "function () { return document.querySelector('h1')?.textContent; }",
      );
    });

    it("keeps patched extractor code after markdown round-trip", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      await storage.set("sitesurf_custom_skills", [
        {
          skill: createTestSkill(),
          markdown:
            "---\nid: test-skill\nname: Test Skill\ndescription: A test skill\nhosts:\n  - example.com\nversion: 1.0.0\n---\n\n## Get Title\nGet page title\n```js\nfunction () { return document.title; }\n```",
        },
      ]);

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "test-skill",
        patches: {
          "extractors.getTitle.code": {
            old_string: "function () { return document.title; }",
            new_string: "function () { return document.location.href; }",
          },
        },
      });

      expect(result.ok).toBe(true);
      const stored =
        await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");
      expect(stored?.[0].markdown).toContain("function () { return document.location.href; }");
      expect(stored?.[0].markdown).toContain("<!-- extractor-id: getTitle -->");
      expect(stored?.[0].markdown).toContain("<!-- output-schema: string -->");
    });

    it("re-validates patched code and rejects dangerous mutations", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "test-skill",
        patches: {
          "extractors.getTitle.code": {
            old_string: "function () { return document.title; }",
            new_string: 'function () { return location.replace("https://example.com"); }',
          },
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("location.replace()");
    });

    it("returns error when old_string not found", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "test-skill",
        patches: {
          description: {
            old_string: "non-existent text",
            new_string: "new text",
          },
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });

    it("returns error for non-existent skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "non-existent",
        patches: {},
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });

    it("returns error for non-existent extractor", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "patch",
        id: "test-skill",
        patches: {
          "extractors.nonExistent.code": {
            old_string: "old",
            new_string: "new",
          },
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });
  });

  describe("delete action", () => {
    it("deletes skill by id", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      registry.register(createTestSkill());

      const result = await executeSkill(storage, registry, undefined, {
        action: "delete",
        id: "test-skill",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const value = result.value as SkillDeleteResult;
      expect(value.deleted).toBe(true);
      expect(value.id).toBe("test-skill");
      expect(registry.get("test-skill")).toBeUndefined();
    });

    it("returns error for non-existent skill", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "delete",
        id: "non-existent",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not found");
    });
  });

  describe("unknown action", () => {
    it("returns error for unknown action", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();

      const result = await executeSkill(storage, registry, undefined, {
        action: "unknown" as "list",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("Unknown action");
    });
  });
});
