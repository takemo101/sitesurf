import { describe, expect, it, beforeEach, vi } from "vitest";
import type { StoragePort } from "@/ports/storage";
import type { Skill } from "@/shared/skill-types";
import { normalizeLegacyExtractorCode } from "@/shared/skill-validation";
import { loadSkillRegistry, CUSTOM_SKILLS_STORAGE_KEY } from "../skill-loader";
import { parseSkillMarkdown } from "@/shared/skill-parser";

vi.mock("@/shared/skill-parser", () => ({
  parseSkillMarkdown: vi.fn(),
}));

global.fetch = vi.fn();

const mockStorage = (): StoragePort => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async <T>(key: string) => store.get(key) as T | null) as <T>(
      key: string,
    ) => Promise<T | null>,
    set: vi.fn(async <T>(key: string, value: T) => {
      store.set(key, value);
    }) as <T>(key: string, value: T) => Promise<void>,
    remove: vi.fn(async (key: string) => {
      store.delete(key);
    }) as (key: string) => Promise<void>,
  };
};

const validSkillMarkdown = `---
id: test-skill
name: Test Skill
hosts:
  - example.com
---

## extract

\`\`\`js
return document.title;
\`\`\`
`;

const validSkillMarkdown2 = `---
id: test-skill-2
name: Test Skill 2
hosts:
  - test.com
---

## extract

\`\`\`js
return "test";
\`\`\`
`;

function withNormalizedExtractorCode(skill: Skill): Skill {
  return {
    ...skill,
    extractors: skill.extractors.map((extractor) => ({
      ...extractor,
      code: normalizeLegacyExtractorCode(extractor.code),
    })),
  };
}

describe("loadSkillRegistry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("ビルトインSkills", () => {
    it("manifestからビルトインSkillsを読み込める", async () => {
      const storage = mockStorage();
      const mockManifest = { version: "1.0.0", builtinSkills: [{ id: "test", file: "test.md" }] };
      const mockSkill: Skill = {
        id: "test-skill",
        name: "Test Skill",
        description: "Test Skill",
        matchers: { hosts: ["example.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return document.title;",
            outputSchema: "unknown",
          },
        ],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => validSkillMarkdown,
        } as Response);

      vi.mocked(parseSkillMarkdown).mockReturnValue({
        ok: true,
        skill: mockSkill,
      });

      const registry = await loadSkillRegistry(storage);

      expect(fetch).toHaveBeenCalledWith("/skills/skills-manifest.json");
      expect(fetch).toHaveBeenCalledWith("/skills/test.md");
      expect(registry.get("test-skill")).toEqual(withNormalizedExtractorCode(mockSkill));
    });

    it("manifestが存在しない場合は空のレジストリが返る", async () => {
      const storage = mockStorage();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const registry = await loadSkillRegistry(storage);

      expect(registry.getAll()).toHaveLength(0);
    });

    it("個別のSkill読み込みエラーは無視して続行", async () => {
      const storage = mockStorage();
      const mockManifest = {
        version: "1.0.0",
        builtinSkills: [
          { id: "valid", file: "valid.md" },
          { id: "invalid", file: "invalid.md" },
        ],
      };
      const mockSkill: Skill = {
        id: "valid-skill",
        name: "Valid Skill",
        description: "Valid Skill",
        matchers: { hosts: ["example.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return {};",
            outputSchema: "unknown",
          },
        ],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => validSkillMarkdown,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      vi.mocked(parseSkillMarkdown).mockReturnValue({
        ok: true,
        skill: mockSkill,
      });

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("valid-skill")).toEqual(withNormalizedExtractorCode(mockSkill));
      expect(registry.get("invalid-skill")).toBeUndefined();
    });

    it("危険なビルトインSkillは登録せずスキップする", async () => {
      const storage = mockStorage();
      const mockManifest = {
        version: "1.0.0",
        builtinSkills: [{ id: "danger", file: "danger.md" }],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => validSkillMarkdown,
        } as Response);

      vi.mocked(parseSkillMarkdown).mockReturnValueOnce({
        ok: true,
        skill: {
          id: "danger-skill",
          name: "Danger Skill",
          description: "Danger",
          matchers: { hosts: ["example.com"] },
          version: "1.0.0",
          extractors: [
            {
              id: "redirect",
              name: "redirect",
              description: "redirect",
              code: 'location.assign("https://example.com")',
              outputSchema: "unknown",
            },
          ],
        },
      });

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("danger-skill")).toBeUndefined();
    });
  });

  describe("カスタムSkills", () => {
    it("StoredSkill[]形式でstorageから読み込める", async () => {
      const storage = mockStorage();
      const mockUserSkill: Skill = {
        id: "user-skill",
        name: "User Skill",
        description: "User Skill",
        matchers: { hosts: ["user.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return {};",
            outputSchema: "unknown",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [
        { skill: mockUserSkill, markdown: validSkillMarkdown },
      ]);

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("user-skill")).toEqual(withNormalizedExtractorCode(mockUserSkill));
    });

    it("legacy bare-body custom skills are normalized when loading from storage", async () => {
      const storage = mockStorage();
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [
        {
          skill: {
            id: "legacy-skill",
            name: "Legacy Skill",
            description: "Legacy Skill",
            matchers: { hosts: ["legacy.com"] },
            version: "0.0.0",
            extractors: [
              {
                id: "extract",
                name: "extract",
                description: "extract",
                code: "return document.title;",
                outputSchema: "string",
              },
            ],
          },
          markdown: "",
        },
      ]);

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("legacy-skill")?.extractors[0].code).toBe(
        "function () {\nreturn document.title;\n}",
      );
    });

    it("stored markdown が richer な場合は markdown を優先して復元する", async () => {
      const storage = mockStorage();
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [
        {
          skill: {
            id: "user-skill",
            name: "User Skill",
            description: "User Skill",
            matchers: { hosts: ["user.com"] },
            version: "0.0.0",
            extractors: [
              {
                id: "extract",
                name: "Extract",
                description: "Extract",
                code: "return {};",
                outputSchema: "unknown",
              },
            ],
          },
          markdown: [
            "---",
            "id: user-skill",
            "name: User Skill",
            "hosts:",
            "  - user.com",
            "version: 0.0.0",
            "---",
            "",
            "## Extract",
            "<!-- extractor-id: extractData -->",
            "<!-- output-schema: { value: string } -->",
            "Extract",
            "",
            "```js",
            "return {};",
            "```",
          ].join("\n"),
        },
      ]);

      vi.mocked(parseSkillMarkdown).mockReturnValueOnce({
        ok: true,
        skill: {
          id: "user-skill",
          name: "User Skill",
          description: "User Skill",
          matchers: { hosts: ["user.com"] },
          version: "0.0.0",
          extractors: [
            {
              id: "extractData",
              name: "Extract",
              description: "Extract",
              code: "return {};",
              outputSchema: "{ value: string }",
            },
          ],
        },
      });

      const registry = await loadSkillRegistry(storage);

      expect(parseSkillMarkdown).toHaveBeenCalled();
      expect(registry.get("user-skill")?.extractors[0].id).toBe("extractData");
      expect(registry.get("user-skill")?.extractors[0].outputSchema).toBe("{ value: string }");
    });

    it("カスタムSkillがビルトインSkillと衝突した場合はビルトインを保持する", async () => {
      const storage = mockStorage();
      const mockManifest = {
        version: "1.0.0",
        builtinSkills: [{ id: "builtin", file: "builtin.md" }],
      };
      const builtinSkill: Skill = {
        id: "test-skill",
        name: "Builtin Skill",
        description: "Builtin",
        matchers: { hosts: ["example.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return 'builtin';",
            outputSchema: "unknown",
          },
        ],
      };
      const userSkill: Skill = {
        id: "test-skill",
        name: "User Skill",
        description: "User",
        matchers: { hosts: ["user.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return 'user';",
            outputSchema: "unknown",
          },
        ],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => validSkillMarkdown,
        } as Response);

      vi.mocked(parseSkillMarkdown).mockReturnValueOnce({ ok: true, skill: builtinSkill });

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [
        { skill: userSkill, markdown: validSkillMarkdown2 },
      ]);

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("test-skill")?.name).toBe("Builtin Skill");
    });

    it("旧形式 (Skill[]) の後方互換でも読み込める", async () => {
      const storage = mockStorage();
      const legacySkill: Skill = {
        id: "legacy-skill",
        name: "Legacy Skill",
        description: "Legacy",
        matchers: { hosts: ["legacy.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return document.title;",
            outputSchema: "string",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [legacySkill]);

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("legacy-skill")).toEqual(withNormalizedExtractorCode(legacySkill));
    });

    it("危険なカスタムSkillは登録せずスキップする", async () => {
      const storage = mockStorage();

      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [
        {
          skill: {
            id: "danger-skill",
            name: "Danger Skill",
            description: "Danger",
            matchers: { hosts: ["example.com"] },
            version: "1.0.0",
            extractors: [
              {
                id: "redirect",
                name: "redirect",
                description: "redirect",
                code: 'location.assign("https://example.com")',
                outputSchema: "unknown",
              },
            ],
          },
          markdown: validSkillMarkdown,
        },
      ]);

      const registry = await loadSkillRegistry(storage);

      expect(registry.get("danger-skill")).toBeUndefined();
    });
  });

  describe("両方のSkills", () => {
    it("ビルトイン・カスタムSkillsの両方を読み込む", async () => {
      const storage = mockStorage();
      const mockManifest = {
        version: "1.0.0",
        builtinSkills: [{ id: "builtin", file: "builtin.md" }],
      };
      const builtinSkill: Skill = {
        id: "builtin-skill",
        name: "Builtin Skill",
        description: "Builtin",
        matchers: { hosts: ["example.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return 'builtin';",
            outputSchema: "unknown",
          },
        ],
      };
      const userSkill: Skill = {
        id: "user-skill",
        name: "User Skill",
        description: "User",
        matchers: { hosts: ["user.com"] },
        version: "0.0.0",
        extractors: [
          {
            id: "extract",
            name: "extract",
            description: "extract",
            code: "return 'user';",
            outputSchema: "unknown",
          },
        ],
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => validSkillMarkdown,
        } as Response);

      vi.mocked(parseSkillMarkdown).mockReturnValueOnce({ ok: true, skill: builtinSkill });

      await storage.set(CUSTOM_SKILLS_STORAGE_KEY, [
        { skill: userSkill, markdown: validSkillMarkdown2 },
      ]);

      const registry = await loadSkillRegistry(storage);

      // ビルトイン(Markdownから読み込み) + カスタム = 2
      expect(registry.getAll()).toHaveLength(2);
      expect(registry.get("builtin-skill")).toEqual(withNormalizedExtractorCode(builtinSkill));
      expect(registry.get("user-skill")).toEqual(withNormalizedExtractorCode(userSkill));
    });
  });
});
