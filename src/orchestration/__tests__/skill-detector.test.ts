import { describe, expect, it } from "vitest";

import { buildSkillDetectionMessage } from "../skill-detector";
import type { SkillMatch } from "@/features/tools/skills";

function getText(message: ReturnType<typeof buildSkillDetectionMessage>): string {
  expect(message).not.toBeNull();
  const part = message?.content[0];
  expect(part?.type).toBe("text");
  if (part?.type !== "text") throw new Error("unreachable");
  return part.text;
}

describe("buildSkillDetectionMessage", () => {
  it("guides the model to call runtime-injected skill extractors", () => {
    const matches: SkillMatch[] = [
      {
        skill: {
          id: "youtube",
          name: "YouTube",
          description: "YouTube skill",
          matchers: { hosts: ["youtube.com"] },
          version: "1.0.0",
          extractors: [
            {
              id: "getVideoInfo",
              name: "Video Info",
              description: "Get video info",
              code: "function () { return document.title; }",
              outputSchema: "string",
            },
          ],
        },
        availableExtractors: [
          {
            id: "getVideoInfo",
            name: "Video Info",
            description: "Get video info",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
        confidence: 100,
      },
    ];

    const message = buildSkillDetectionMessage(matches);
    const text = getText(message);

    expect(text).not.toContain("browserjs(new Function(code))");
    expect(text).not.toContain("new Function(`return (${code})`)()");
    expect(text).toContain("window.youtube.getVideoInfo()");
  });

  it("surfaces a Guidance line and omits the browserjs() tail for an instruction-only skill", () => {
    const instructionsOnlyMatch: SkillMatch = {
      skill: {
        id: "github-guidance",
        name: "GitHub Guidance",
        description: "GitHub 向け guidance",
        matchers: { hosts: ["github.com"] },
        version: "0.1.0",
        extractors: [],
        instructionsMarkdown: "GitHub では task に応じて API / bgFetch を優先すること。",
      },
      availableExtractors: [],
      confidence: 85,
    };

    const message = buildSkillDetectionMessage([instructionsOnlyMatch]);
    const text = getText(message);

    expect(text).toContain('Skill "GitHub Guidance" (id: github-guidance, site-specific)');
    expect(text).toContain("Guidance: GitHub では task に応じて API / bgFetch を優先すること。");
    // instruction-only なので extractor bullet も browserjs() ヒントも不要。
    expect(text).not.toMatch(/^ {2}- github-guidance\./m);
    expect(text).not.toContain("browserjs(");
    expect(text).not.toContain("window.youtube.getVideoInfo()");
  });

  it("includes both extractor bullets and a Guidance line for a mixed skill", () => {
    const mixedMatch: SkillMatch = {
      skill: {
        id: "gh-repo",
        name: "GitHub Repo",
        description: "GitHub リポジトリ分析",
        matchers: { hosts: ["github.com"], paths: ["/*/*/tree/**"] },
        version: "0.2.0",
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "ページタイトルを取得",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
        instructionsMarkdown: "repo 全体の分析では API / bgFetch を優先すること。",
      },
      availableExtractors: [
        {
          id: "getTitle",
          name: "Get Title",
          description: "ページタイトルを取得",
          code: "function () { return document.title; }",
          outputSchema: "string",
        },
      ],
      confidence: 100,
      activationLevel: "contextual",
    };

    const message = buildSkillDetectionMessage([mixedMatch]);
    const text = getText(message);

    expect(text).toContain("  - gh-repo.getTitle: ページタイトルを取得");
    expect(text).toContain("Guidance: repo 全体の分析では API / bgFetch を優先すること。");
    // extractor があるので browserjs() ヒントは出す。
    expect(text).toContain("browserjs(");
  });

  it("drops skills that have neither extractors nor summarizable instructions", () => {
    const noExtractorsNoGuidance: SkillMatch = {
      skill: {
        id: "empty-skill",
        name: "Empty Skill",
        description: "nothing useful",
        matchers: { hosts: ["example.com"] },
        version: "0.1.0",
        extractors: [],
        instructionsMarkdown: "## heading only\n## another heading",
      },
      availableExtractors: [],
      confidence: 80,
    };

    const message = buildSkillDetectionMessage([noExtractorsNoGuidance]);
    expect(message).toBeNull();
  });

  it("returns null when the only matches are unsummarizable instruction-only skills", () => {
    const headingsOnly: SkillMatch = {
      skill: {
        id: "headings-only",
        name: "Headings Only",
        description: "heading only",
        matchers: { hosts: ["example.com"] },
        version: "0.1.0",
        extractors: [],
        instructionsMarkdown: "## a\n## b\n## c",
      },
      availableExtractors: [],
      confidence: 80,
    };

    expect(buildSkillDetectionMessage([headingsOnly])).toBeNull();
  });

  it("emits browserjs() tail only when at least one listed skill has extractors", () => {
    const extractorMatch: SkillMatch = {
      skill: {
        id: "yt",
        name: "YT",
        description: "yt",
        matchers: { hosts: ["youtube.com"] },
        version: "1.0.0",
        extractors: [
          {
            id: "get",
            name: "Get",
            description: "get",
            code: "function () { return 1; }",
            outputSchema: "number",
          },
        ],
      },
      availableExtractors: [
        {
          id: "get",
          name: "Get",
          description: "get",
          code: "function () { return 1; }",
          outputSchema: "number",
        },
      ],
      confidence: 100,
    };
    const instructionsOnly: SkillMatch = {
      skill: {
        id: "guide",
        name: "Guide",
        description: "guide",
        matchers: { hosts: ["example.com"] },
        version: "0.1.0",
        extractors: [],
        instructionsMarkdown: "使い方の一行ガイダンス。",
      },
      availableExtractors: [],
      confidence: 80,
    };

    const textMixed = getText(buildSkillDetectionMessage([instructionsOnly, extractorMatch]));
    expect(textMixed).toContain("browserjs(");

    const textInstructionOnly = getText(buildSkillDetectionMessage([instructionsOnly]));
    expect(textInstructionOnly).not.toContain("browserjs(");
  });
});
