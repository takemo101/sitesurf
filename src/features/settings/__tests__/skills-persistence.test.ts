import { describe, expect, it } from "vitest";

import { InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import type { Skill } from "@/shared/skill-types";

import { loadCustomSkills, saveCustomSkills } from "../skills-persistence";

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

describe("skills-persistence", () => {
  it("loadCustomSkills canonicalizes stored markdown from skill object", async () => {
    const storage = new InMemoryStorage();
    await storage.set("sitesurf_custom_skills", [
      {
        skill: createSkill(),
        markdown:
          "---\nid: test-skill\nname: Test Skill\ndescription: A test skill\nhosts:\n  - example.com\nversion: 1.0.0\n---\n\n## Get Title\nGet page title\n```js\nfunction () { return document.title; }\n```",
      },
    ]);

    const loaded = await loadCustomSkills(storage);

    expect(loaded[0].markdown).toContain("<!-- extractor-id:");
    expect(loaded[0].markdown).toContain("<!-- output-schema:");
  });

  it("loadCustomSkills prefers stored markdown when it contains richer metadata", async () => {
    const storage = new InMemoryStorage();
    await storage.set("sitesurf_custom_skills", [
      {
        skill: {
          ...createSkill(),
          extractors: [
            {
              ...createSkill().extractors[0],
              id: "get-title",
              outputSchema: "unknown",
            },
          ],
        },
        markdown: [
          "---",
          "id: test-skill",
          "name: Test Skill",
          "description: A test skill",
          "hosts:",
          "  - example.com",
          "version: 1.0.0",
          "---",
          "",
          "## Get Title",
          "<!-- extractor-id: getTitle -->",
          "<!-- output-schema: string -->",
          "Get page title",
          "",
          "```js",
          "function () { return document.title; }",
          "```",
          "",
        ].join("\n"),
      },
    ]);

    const loaded = await loadCustomSkills(storage);

    expect(loaded[0].skill.extractors[0].id).toBe("getTitle");
    expect(loaded[0].skill.extractors[0].outputSchema).toBe("string");
  });

  it("saveCustomSkills writes canonical markdown", async () => {
    const storage = new InMemoryStorage();

    await saveCustomSkills(storage, [
      {
        skill: createSkill(),
        markdown: "legacy markdown",
      },
    ]);

    const stored =
      await storage.get<Array<{ skill: Skill; markdown: string }>>("sitesurf_custom_skills");

    expect(stored?.[0].markdown).toContain("<!-- extractor-id: getTitle -->");
    expect(stored?.[0].markdown).toContain("<!-- output-schema: string -->");
  });
});
