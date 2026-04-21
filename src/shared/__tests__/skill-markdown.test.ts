import { describe, expect, it } from "vitest";
import { renderSkillMarkdown } from "../skill-markdown";
import { parseSkillMarkdown } from "../skill-parser";
import type { Skill } from "../skill-types";

function roundTrip(skill: Skill): Skill {
  const markdown = renderSkillMarkdown(skill);
  const parsed = parseSkillMarkdown(markdown);
  if (!parsed.ok) {
    throw new Error(`Failed to re-parse rendered markdown: ${parsed.errors.join("; ")}`);
  }
  return parsed.skill;
}

const extractorsOnlySkill: Skill = {
  id: "youtube",
  name: "YouTube",
  description: "YouTube動画ページの情報抽出",
  scope: "site",
  matchers: { hosts: ["youtube.com"], paths: ["/watch"] },
  extractors: [
    {
      id: "videoInfo",
      name: "videoInfo",
      description: "タイトルを取得する。",
      outputSchema: "{ title: string }",
      code: "function () {\n  return { title: document.title };\n}",
    },
  ],
  version: "0.1.0",
};

const instructionsOnlySkill: Skill = {
  id: "github-guidance",
  name: "GitHub Guidance",
  description: "GitHub に関する軽い guidance",
  scope: "global",
  matchers: { hosts: [] },
  extractors: [],
  version: "0.1.0",
  instructionsMarkdown:
    "GitHub では task に応じて API / DOM のどれが最適かを先に判断すること。\n\n## Always\nrepo 分析でない限り過剰適用しない。",
};

const mixedSkill: Skill = {
  id: "github-repo-analyzer",
  name: "GitHub Repo Analyzer",
  description: "GitHub リポジトリ分析支援",
  scope: "global",
  matchers: { hosts: [] },
  extractors: [
    {
      id: "getVisibleFileList",
      name: "Get Visible File List",
      description: "現在表示中のファイル一覧だけを取得する。",
      outputSchema: "{ files: string[] }",
      code: "function () {\n  return { files: [] };\n}",
    },
  ],
  version: "0.2.0",
  instructionsMarkdown:
    "## Always\nGitHub pages may have CSP limitations.\n\n## Task: Repository Analysis\nrepo 全体の分析では DOM extractor を万能手段として扱わない。",
};

describe("renderSkillMarkdown", () => {
  it("extractors-only skill は旧形式互換 (# Instructions / # Extractors 見出しを出さない)", () => {
    const markdown = renderSkillMarkdown(extractorsOnlySkill);
    expect(markdown).not.toMatch(/^# Instructions$/m);
    expect(markdown).not.toMatch(/^# Extractors$/m);
    expect(markdown).toContain("## videoInfo");
  });

  it("instructions-only skill は # Instructions セクションを出し、# Extractors を出さない", () => {
    const markdown = renderSkillMarkdown(instructionsOnlySkill);
    expect(markdown).toMatch(/^# Instructions$/m);
    expect(markdown).not.toMatch(/^# Extractors$/m);
    expect(markdown).toContain("GitHub では task に応じて");
  });

  it("mixed skill は # Instructions を # Extractors より先に出す", () => {
    const markdown = renderSkillMarkdown(mixedSkill);
    const instructionsAt = markdown.indexOf("# Instructions");
    const extractorsAt = markdown.indexOf("# Extractors");
    expect(instructionsAt).toBeGreaterThanOrEqual(0);
    expect(extractorsAt).toBeGreaterThan(instructionsAt);
  });
});

describe("skill markdown round-trip", () => {
  it("extractors-only skill を round-trip できる", () => {
    const restored = roundTrip(extractorsOnlySkill);
    expect(restored.id).toBe(extractorsOnlySkill.id);
    expect(restored.extractors).toHaveLength(1);
    expect(restored.extractors[0].id).toBe("videoInfo");
    expect(restored.extractors[0].code).toBe(extractorsOnlySkill.extractors[0].code);
    expect(restored.instructionsMarkdown).toBeUndefined();
  });

  it("instructions-only skill を round-trip できる", () => {
    const restored = roundTrip(instructionsOnlySkill);
    expect(restored.id).toBe(instructionsOnlySkill.id);
    expect(restored.extractors).toHaveLength(0);
    expect(restored.instructionsMarkdown?.trim()).toBe(
      instructionsOnlySkill.instructionsMarkdown?.trim(),
    );
  });

  it("mixed skill を round-trip できる (instructions と extractors の両方が保存される)", () => {
    const restored = roundTrip(mixedSkill);
    expect(restored.extractors).toHaveLength(1);
    expect(restored.extractors[0].id).toBe("getVisibleFileList");
    expect(restored.extractors[0].outputSchema).toBe("{ files: string[] }");
    expect(restored.instructionsMarkdown).toContain("GitHub pages may have CSP limitations.");
    expect(restored.instructionsMarkdown).toContain("repo 全体の分析では");
  });

  it("旧形式の markdown (section marker なし) は現行 renderer で extractors-only として round-trip できる", () => {
    const legacyMarkdown = `---
id: youtube
name: YouTube
description: YouTube動画ページの情報抽出
hosts:
  - youtube.com
paths:
  - /watch
version: 0.1.0
---

## videoInfo
<!-- extractor-id: videoInfo -->
<!-- output-schema: { title: string } -->
タイトルを取得する。
\`\`\`js
function () {
  return { title: document.title };
}
\`\`\`
`;
    const parsed = parseSkillMarkdown(legacyMarkdown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const rendered = renderSkillMarkdown(parsed.skill);
    expect(rendered).not.toMatch(/^# Instructions$/m);
    expect(rendered).not.toMatch(/^# Extractors$/m);

    const restored = parseSkillMarkdown(rendered);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.skill.extractors).toHaveLength(1);
    expect(restored.skill.extractors[0].id).toBe("videoInfo");
    expect(restored.skill.instructionsMarkdown).toBeUndefined();
  });
});
