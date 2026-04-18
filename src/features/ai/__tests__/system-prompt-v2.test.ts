import { describe, expect, it } from "vitest";
import { getSystemPromptV2, generateVisitedUrlsSection } from "../system-prompt-v2";
import type { VisitedUrlEntry } from "../system-prompt-v2";
import type { SkillMatch } from "@/shared/skill-types";

const mockSkillMatch: SkillMatch = {
  skill: {
    id: "test-skill",
    name: "Test Skill",
    description: "A test skill",
    matchers: { hosts: ["test.com"] },
    version: "0.0.0",
    extractors: [
      {
        id: "ext-1",
        name: "Test Extractor",
        description: "Extracts test data",
        code: "function () { return document.title; }",
        outputSchema: "string",
      },
    ],
  },
  availableExtractors: [],
  confidence: 0,
};

describe("getSystemPromptV2", () => {
  it("returns a non-empty string", () => {
    const prompt = getSystemPromptV2({});
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("returns same value for same options (cache hit)", () => {
    const options = { includeSkills: false };
    const first = getSystemPromptV2(options);
    const second = getSystemPromptV2(options);
    expect(first).toBe(second);
  });

  it("excludes skills section when includeSkills is false", () => {
    const prompt = getSystemPromptV2({ includeSkills: false, skills: [mockSkillMatch] });
    expect(prompt).not.toContain("Skills: Site-Specific Extraction");
  });

  it("includes skills section when includeSkills is true and skills have available extractors", () => {
    const skillMatch: SkillMatch = {
      ...mockSkillMatch,
      skill: { ...mockSkillMatch.skill, name: "YouTube" },
      availableExtractors: mockSkillMatch.skill.extractors,
      confidence: 85,
    };
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skillMatch] });
    expect(prompt).toContain("Skills: Site-Specific Extraction");
    expect(prompt).toContain("YouTube");
    expect(prompt).toContain("Run extractor.code by reconstructing it first:");
    expect(prompt).toContain('const code = skills["test-skill"].extractors["ext-1"].code;');
    expect(prompt).toContain("const fn = new Function(`return (${code})`)();");
  });

  it("includes global skills in a separate section", () => {
    const skillMatch: SkillMatch = {
      ...mockSkillMatch,
      skill: {
        ...mockSkillMatch.skill,
        id: "dom-mutation",
        name: "DOM Mutation",
        scope: "global",
        matchers: { hosts: [] },
      },
      availableExtractors: mockSkillMatch.skill.extractors,
      confidence: 100,
    };

    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skillMatch] });
    expect(prompt).toContain("Skills: Global");
    expect(prompt).toContain("DOM Mutation");
  });

  it("excludes skills section when skills have no available extractors", () => {
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [mockSkillMatch] });
    expect(prompt).not.toContain("Skills: Site-Specific Extraction");
  });

  it("excludes skills section when includeSkills is true but no skills provided", () => {
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [] });
    expect(prompt).not.toContain("Skills: Site-Specific Extraction");
  });

  it("contains Tool Philosophy in system prompt while keeping REPL-specific sections out", () => {
    const prompt = getSystemPromptV2({});
    expect(prompt).toContain("Tool Philosophy");
    expect(prompt).toContain("Security Boundary");
    expect(prompt).toContain("Completion Principles");
    expect(prompt).not.toContain("Available Functions");
    expect(prompt).not.toContain("Common Patterns");
  });

  it("contains strong directives (NEVER clauses via SECURITY_BOUNDARY)", () => {
    const prompt = getSystemPromptV2({});
    expect(prompt).toContain("NEVER");
  });

  it("system prompt は bgFetch の記述を含まない (repl description 側で管理)", () => {
    for (const enableBgFetch of [true, false, undefined]) {
      const prompt = getSystemPromptV2(
        enableBgFetch === undefined ? {} : { enableBgFetch },
      );
      expect(prompt).not.toContain("bgFetch(url, options?)");
      expect(prompt).not.toContain("BG_FETCH_SECTION_START");
      expect(prompt).not.toContain("BG_FETCH_SECTION_END");
    }
  });
});

describe("generateVisitedUrlsSection", () => {
  function makeEntry(url: string, title: string, visitCount: number): VisitedUrlEntry {
    return { url, title, visitedAt: Date.now(), visitCount, lastMethod: "navigate" };
  }

  it("returns empty string for empty entries", () => {
    expect(generateVisitedUrlsSection([])).toBe("");
  });

  it("returns section header and URL lines for non-empty entries", () => {
    const section = generateVisitedUrlsSection([makeEntry("https://example.com", "Example", 2)]);
    expect(section).toContain("## Current Session: Visited URLs");
    expect(section).toContain("https://example.com");
    expect(section).toContain("Example");
    expect(section).toContain("[2x, via navigate]");
  });

  it("omits section from getSystemPromptV2 when visitedUrls is empty", () => {
    const prompt = getSystemPromptV2({ visitedUrls: [] });
    expect(prompt).not.toContain("## Current Session: Visited URLs");
  });

  it("injects section into getSystemPromptV2 when visitedUrls provided", () => {
    const prompt = getSystemPromptV2({
      visitedUrls: [makeEntry("https://example.com", "Example", 1)],
    });
    expect(prompt).toContain("## Current Session: Visited URLs");
    expect(prompt).toContain("https://example.com");
  });
});
