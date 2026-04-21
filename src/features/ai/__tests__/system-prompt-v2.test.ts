import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  getSystemPromptV2,
  generateVisitedUrlsSection,
  generateSkillsSectionForLoop,
  getActiveSkillIds,
} from "../system-prompt-v2";
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
  it("has removed legacy system prompt modules", () => {
    expect(existsSync(path.resolve(import.meta.dirname, "../system-prompt.ts"))).toBe(false);
    expect(existsSync(path.resolve(import.meta.dirname, "../../chat/system-prompt.ts"))).toBe(
      false,
    );
  });

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

  it("includes skill metadata and runtime usage when includeSkills is true and skills have available extractors", () => {
    const extractor = {
      ...mockSkillMatch.skill.extractors[0],
      id: "getVideoInfo",
    };
    const skillMatch: SkillMatch = {
      ...mockSkillMatch,
      skill: {
        ...mockSkillMatch.skill,
        id: "youtube",
        name: "YouTube",
        extractors: [extractor],
      },
      availableExtractors: [extractor],
      confidence: 85,
    };
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skillMatch] });
    expect(prompt).toContain("Skills: Site-Specific Extraction");
    expect(prompt).toContain("YouTube");
    expect(prompt).toContain("- getVideoInfo(): string — Extracts test data");
    expect(prompt).toContain("const info = await browserjs(() => window.youtube.getVideoInfo());");
    expect(prompt).not.toContain("Run extractor.code by reconstructing it first:");
    expect(prompt).not.toContain("function () { return document.title; }");
    expect(prompt).not.toContain("new Function(`return (${code})`)();");
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
      const prompt = getSystemPromptV2(enableBgFetch === undefined ? {} : { enableBgFetch });
      expect(prompt).not.toContain("bgFetch(url, options?)");
      expect(prompt).not.toContain("BG_FETCH_SECTION_START");
      expect(prompt).not.toContain("BG_FETCH_SECTION_END");
    }
  });
});

describe("generateSkillsSectionForLoop / shownSkillIds diff rendering", () => {
  function makeSkillMatch(id: string, name: string, scope?: "global"): SkillMatch {
    const extractor = {
      id: `${id}-ext`,
      name: "Extractor",
      description: "Gets data",
      code: "function() {}",
      outputSchema: "string",
    };
    return {
      skill: {
        id,
        name,
        description: `${name} description`,
        matchers: scope ? { hosts: [] } : { hosts: [`${id}.com`] },
        version: "0.0.0",
        scope,
        extractors: [extractor],
      },
      availableExtractors: [extractor],
      confidence: 80,
    };
  }

  it("renders full format when shownSkillIds is empty (first turn)", () => {
    const match = makeSkillMatch("yt", "YouTube");
    const section = generateSkillsSectionForLoop([match], new Set());
    expect(section).toContain("**YouTube**");
    expect(section).toContain("id: yt");
    expect(section).toContain("yt-ext():");
    expect(section).toContain("browserjs");
  });

  it("renders short format for already-seen skills (subsequent turns)", () => {
    const match = makeSkillMatch("yt", "YouTube");
    const shownSkillIds = new Set(["yt"]);
    const section = generateSkillsSectionForLoop([match], shownSkillIds);
    expect(section).toContain("- YouTube (id: yt):");
    expect(section).not.toContain("**YouTube**");
    expect(section).not.toContain("browserjs");
    expect(section).not.toContain("yt-ext():");
  });

  it("renders full format for new skill and short format for seen skill", () => {
    const seen = makeSkillMatch("yt", "YouTube");
    const newSkill = makeSkillMatch("github", "GitHub");
    const shownSkillIds = new Set(["yt"]);
    const section = generateSkillsSectionForLoop([seen, newSkill], shownSkillIds);
    // YouTube already seen → short
    expect(section).toContain("- YouTube (id: yt):");
    expect(section).not.toContain("**YouTube**");
    // GitHub new → full
    expect(section).toContain("**GitHub**");
    expect(section).toContain("github-ext():");
  });

  it("getActiveSkillIds returns only skills that are visible in the prompt", () => {
    const withExt = makeSkillMatch("yt", "YouTube");
    const noExt: SkillMatch = {
      ...withExt,
      skill: { ...withExt.skill, id: "empty" },
      availableExtractors: [],
    };
    const ids = getActiveSkillIds([withExt, noExt]);
    expect(ids).toEqual(["yt"]);
  });

  it("getActiveSkillIds includes instruction-only skills", () => {
    const withExt = makeSkillMatch("yt", "YouTube");
    const instructionOnly: SkillMatch = {
      ...withExt,
      skill: {
        ...withExt.skill,
        id: "guidance",
        name: "Guidance",
        extractors: [],
        instructionsMarkdown: "Use API over DOM when possible.",
      },
      availableExtractors: [],
    };
    const ids = getActiveSkillIds([withExt, instructionOnly]);
    expect(ids).toEqual(expect.arrayContaining(["yt", "guidance"]));
    expect(ids).toHaveLength(2);
  });

  it("getSystemPromptV2 with shownSkillIds renders short format for seen skill", () => {
    const match = makeSkillMatch("yt", "YouTube");
    const prompt = getSystemPromptV2({
      includeSkills: true,
      skills: [match],
      shownSkillIds: new Set(["yt"]),
    });
    expect(prompt).toContain("- YouTube (id: yt):");
    expect(prompt).not.toContain("**YouTube**");
  });

  it("getSystemPromptV2 with empty shownSkillIds renders full format", () => {
    const match = makeSkillMatch("yt", "YouTube");
    const prompt = getSystemPromptV2({
      includeSkills: true,
      skills: [match],
      shownSkillIds: new Set(),
    });
    expect(prompt).toContain("**YouTube**");
    expect(prompt).toContain("browserjs");
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

describe("skill instruction layer in prompt", () => {
  function makeExtractorSkill(id: string, name: string, scope?: "global"): SkillMatch {
    const extractor = {
      id: `${id}-ext`,
      name: "Extractor",
      description: "Gets data",
      code: "function() {}",
      outputSchema: "string",
    };
    return {
      skill: {
        id,
        name,
        description: `${name} description`,
        matchers: scope ? { hosts: [] } : { hosts: [`${id}.com`] },
        version: "0.0.0",
        scope,
        extractors: [extractor],
      },
      availableExtractors: [extractor],
      confidence: 80,
    };
  }

  function makeInstructionOnlySkill(
    id: string,
    name: string,
    instructionsMarkdown: string,
    scope: "global" | undefined = "global",
  ): SkillMatch {
    return {
      skill: {
        id,
        name,
        description: `${name} description`,
        matchers: scope === "global" ? { hosts: [] } : { hosts: [`${id}.com`] },
        version: "0.0.0",
        scope,
        extractors: [],
        instructionsMarkdown,
      },
      availableExtractors: [],
      confidence: 100,
    };
  }

  it("keeps extractor-only skills free of the Guidance line", () => {
    const section = generateSkillsSectionForLoop([makeExtractorSkill("yt", "YouTube")], new Set());
    expect(section).not.toContain("Guidance:");
    expect(section).toContain("yt-ext():");
    expect(section).toContain("browserjs");
  });

  it("renders an instruction-only skill without extractor bullets or browserjs example", () => {
    const skill = makeInstructionOnlySkill(
      "github-guidance",
      "GitHub Guidance",
      "Use API / bgFetch over DOM for repo analysis tasks.",
    );
    const section = generateSkillsSectionForLoop([skill], new Set());
    expect(section).toContain("**GitHub Guidance**");
    expect(section).toContain("Guidance: Use API / bgFetch over DOM for repo analysis tasks.");
    expect(section).not.toContain("browserjs");
    expect(section).not.toMatch(/^-\s+\w+\(\):/m);
  });

  it("renders a mixed skill with both extractor metadata and a Guidance line", () => {
    const extractor = {
      id: "getTitle",
      name: "Get Title",
      description: "Returns the page title",
      code: "function () { return document.title; }",
      outputSchema: "string",
    };
    const mixed: SkillMatch = {
      skill: {
        id: "github-repo",
        name: "GitHub Repo",
        description: "Analysis helpers for GitHub repositories",
        matchers: { hosts: ["github.com"] },
        version: "0.2.0",
        extractors: [extractor],
        instructionsMarkdown:
          "Prefer static API retrieval before relying on DOM extractors for repo analysis.",
      },
      availableExtractors: [extractor],
      confidence: 100,
    };
    const section = generateSkillsSectionForLoop([mixed], new Set());
    expect(section).toContain("**GitHub Repo**");
    expect(section).toContain("- getTitle(): string — Returns the page title");
    expect(section).toContain("browserjs");
    expect(section).toContain("Guidance: Prefer static API retrieval");
  });

  it("does not inject the full instruction markdown into the prompt", () => {
    const longBody = [
      "## Always",
      "First body line: keep this short.",
      "",
      "## Task: Repository Analysis",
      "Another multi-line section describing how to proceed for repo analysis tasks.",
      "More detail that should never appear in the prompt verbatim.",
    ].join("\n");
    const skill = makeInstructionOnlySkill("github-long", "GitHub Long", longBody);
    const section = generateSkillsSectionForLoop([skill], new Set());
    // The first non-heading body line becomes the passive summary.
    expect(section).toContain("Guidance: First body line: keep this short.");
    // Headings and subsequent sections must not leak into the prompt.
    expect(section).not.toContain("## Always");
    expect(section).not.toContain("## Task: Repository Analysis");
    expect(section).not.toContain("Another multi-line section");
    expect(section).not.toContain("More detail that should never appear");
  });

  it("truncates overlong first-line summaries with an ellipsis", () => {
    const long = "x".repeat(200);
    const skill = makeInstructionOnlySkill("long", "Long", long);
    const section = generateSkillsSectionForLoop([skill], new Set());
    const guidanceLine = section.split("\n").find((line) => line.startsWith("Guidance:"));
    expect(guidanceLine).toBeDefined();
    if (!guidanceLine) return;
    expect(guidanceLine.endsWith("…")).toBe(true);
    // "Guidance: " + up to 120 chars.
    expect(guidanceLine.length).toBeLessThanOrEqual("Guidance: ".length + 120);
  });

  it("skips markdown heading lines when summarizing", () => {
    const body = "## Always\n\nThe actual guidance body is on this line.";
    const skill = makeInstructionOnlySkill("heading-first", "Heading First", body);
    const section = generateSkillsSectionForLoop([skill], new Set());
    expect(section).toContain("Guidance: The actual guidance body is on this line.");
  });

  it("strips leading list markers when summarizing", () => {
    const body = "- First bullet point with guidance.";
    const skill = makeInstructionOnlySkill("list-first", "List First", body);
    const section = generateSkillsSectionForLoop([skill], new Set());
    expect(section).toContain("Guidance: First bullet point with guidance.");
  });

  it("also surfaces Guidance in short format for already-seen skills", () => {
    const skill = makeInstructionOnlySkill("seen", "Seen", "Some passive guidance line.");
    const section = generateSkillsSectionForLoop([skill], new Set(["seen"]));
    expect(section).toContain("- Seen (id: seen):");
    expect(section).toContain("Guidance: Some passive guidance line.");
  });

  it("includes instruction-only global skills in the Global skills section", () => {
    const skill = makeInstructionOnlySkill(
      "github-guidance",
      "GitHub Guidance",
      "General guidance.",
    );
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skill] });
    expect(prompt).toContain("Skills: Global");
    expect(prompt).toContain("**GitHub Guidance**");
    expect(prompt).toContain("Guidance: General guidance.");
  });

  it("still omits the skills section when no skill carries extractors or instructions", () => {
    const skill: SkillMatch = {
      ...makeExtractorSkill("empty", "Empty"),
      availableExtractors: [],
    };
    skill.skill = { ...skill.skill, instructionsMarkdown: undefined, extractors: [] };
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skill] });
    expect(prompt).not.toContain("Skills: Site-Specific Extraction");
    expect(prompt).not.toContain("Skills: Global");
  });

  it("skips fenced code blocks when summarizing instructions", () => {
    const body = [
      "```js",
      "// 書式例をまず示す",
      "function () { return { files: [] }; }",
      "```",
      "",
      "repo 分析では API / bgFetch を優先すること。",
    ].join("\n");
    const skill = makeInstructionOnlySkill("github-repo", "GitHub Repo", body);
    const section = generateSkillsSectionForLoop([skill], new Set());

    expect(section).toContain("Guidance: repo 分析では API / bgFetch を優先すること。");
    // Code fence markers and code content must not appear in the prompt.
    expect(section).not.toContain("```js");
    expect(section).not.toContain("function () { return { files: [] }; }");
    // And the opening fence must not have been picked up as the Guidance line.
    expect(section).not.toMatch(/^Guidance:\s*```/m);
  });

  it("hides instruction-only skills whose body is only headings (no summarizable content)", () => {
    const body = ["## Always", "", "## Task: Repository Analysis"].join("\n");
    const skill = makeInstructionOnlySkill("headings-only", "Headings Only", body);
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skill] });

    expect(prompt).not.toContain("Skills: Global");
    expect(prompt).not.toContain("**Headings Only**");
    expect(prompt).not.toContain("Headings Only description");
  });

  it("hides instruction-only skills whose body is only a code block", () => {
    const body = ["```js", "// nothing useful for the AI here", "```"].join("\n");
    const skill = makeInstructionOnlySkill("fenced-only", "Fenced Only", body);
    const prompt = getSystemPromptV2({ includeSkills: true, skills: [skill] });

    expect(prompt).not.toContain("**Fenced Only**");
  });

  it("excludes unsummarizable instruction-only skills from getActiveSkillIds", () => {
    const summarizable = makeInstructionOnlySkill("ok", "Ok", "Good guidance.");
    const headingsOnly = makeInstructionOnlySkill("headings", "Headings", "## One\n## Two");
    const ids = getActiveSkillIds([summarizable, headingsOnly]);
    expect(ids).toEqual(["ok"]);
  });
});
