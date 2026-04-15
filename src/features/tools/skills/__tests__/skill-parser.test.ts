import { describe, expect, it } from "vitest";
import { parseSkillMarkdown } from "../skill-parser";

describe("parseSkillMarkdown", () => {
  describe("正常系", () => {
    it("最小限の有効なMarkdownをパースできる", () => {
      const markdown = `---
id: test-skill
name: Test Skill
hosts:
  - example.com
---

## extract

description text

\`\`\`js
return document.title;
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("test-skill");
      expect(result.skill.name).toBe("Test Skill");
      expect(result.skill.description).toBe("Test Skill");
      expect(result.skill.matchers.hosts).toEqual(["example.com"]);
      expect(result.skill.extractors).toHaveLength(1);
      expect(result.skill.extractors[0].id).toBe("extract");
      expect(result.skill.extractors[0].name).toBe("extract");
      expect(result.skill.extractors[0].description).toBe("description text");
      expect(result.skill.extractors[0].code).toBe("return document.title;");
    });

    it("descriptionを含む完全なMarkdownをパースできる", () => {
      const markdown = `---
id: example-skill
name: Example Skill
description: 説明文
hosts:
  - example.com
  - www.example.com
paths:
  - /path1
---

## extractorId

Extractorの説明

\`\`\`js
return document.title;
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("example-skill");
      expect(result.skill.name).toBe("Example Skill");
      expect(result.skill.description).toBe("説明文");
      expect(result.skill.matchers.hosts).toEqual(["example.com", "www.example.com"]);
      expect(result.skill.matchers.paths).toEqual(["/path1"]);
    });

    it("複数のextractorをパースできる", () => {
      const markdown = `---
id: multi-extractor
name: Multi Extractor
hosts:
  - example.com
---

## firstExtractor

First description

\`\`\`js
return "first";
\`\`\`

## secondExtractor

Second description

\`\`\`js
return "second";
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(2);
      expect(result.skill.extractors[0].id).toBe("first-extractor");
      expect(result.skill.extractors[0].name).toBe("firstExtractor");
      expect(result.skill.extractors[1].id).toBe("second-extractor");
      expect(result.skill.extractors[1].name).toBe("secondExtractor");
    });

    it("PascalCaseのheadingをkebab-caseに変換する", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

## VideoInfo

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors[0].id).toBe("video-info");
    });

    it("snake_caseのheadingをkebab-caseに変換する", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

## video_info

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors[0].id).toBe("video-info");
    });

    it("スペースを含むheadingをkebab-caseに変換する", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

## Video Info

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors[0].id).toBe("video-info");
    });

    it("descriptionがない場合はheadingをdescriptionとして使う", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

## myExtractor

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors[0].description).toBe("myExtractor");
    });

    it("YouTube skillの例をパースできる", () => {
      const markdown = `---
id: youtube
name: YouTube
description: YouTube動画ページの情報抽出
hosts:
  - youtube.com
  - youtu.be
paths:
  - /watch
---

## videoInfo

タイトル、チャンネル名、説明文、再生回数を取得

\`\`\`js
const title = document.querySelector("h1")?.textContent?.trim();
return { title };
\`\`\`

## comments

上位5件のコメントを取得

\`\`\`js
return [];
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("youtube");
      expect(result.skill.name).toBe("YouTube");
      expect(result.skill.extractors).toHaveLength(2);
      expect(result.skill.extractors[0].id).toBe("video-info");
      expect(result.skill.extractors[1].id).toBe("comments");
    });

    it("global skill を hosts なしでパースできる", () => {
      const markdown = `---
id: dom-mutation
name: DOM Mutation
scope: global
selectors:
  - body
---

## highlightTargets

\`\`\`js
return { ok: true, changed: 1 };
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.scope).toBe("global");
      expect(result.skill.matchers.hosts).toEqual([]);
      expect(result.skill.metadata?.domIndicators?.selectors).toEqual(["body"]);
    });

    it("legacy signals を domIndicators.selectors にマップする", () => {
      const markdown = `---
id: youtube
name: YouTube
hosts:
  - youtube.com
signals:
  - ytd-watch-metadata
---

## videoInfo

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.metadata?.domIndicators?.selectors).toEqual(["ytd-watch-metadata"]);
    });

    it("extractor metadata comments から id と outputSchema を復元できる", () => {
      const markdown = [
        "---",
        "id: test-skill",
        "name: Test Skill",
        "hosts:",
        "  - example.com",
        "version: 1.0.0",
        "---",
        "",
        "## Get Title",
        "<!-- extractor-id: getTitle -->",
        "<!-- output-schema: { title: string } -->",
        "Get page title",
        "",
        "```js",
        "return document.title;",
        "```",
        "",
      ].join("\n");
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors[0].id).toBe("getTitle");
      expect(result.skill.extractors[0].outputSchema).toBe("{ title: string }");
      expect(result.skill.extractors[0].description).toBe("Get page title");
    });
  });

  describe("エラー系", () => {
    it("frontmatterがない場合はエラー", () => {
      const markdown = `# Just a heading`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toContain(
        "YAML frontmatter not found. Must start with --- and end with ---",
      );
    });

    it("idがない場合はエラー", () => {
      const markdown = `---
name: Test
hosts:
  - example.com
---

## extract

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toContain("Missing or empty 'id' in frontmatter");
    });

    it("nameがない場合はエラー", () => {
      const markdown = `---
id: test
hosts:
  - example.com
---

## extract

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toContain("Missing or empty 'name' in frontmatter");
    });

    it("hostsがない場合はエラー", () => {
      const markdown = `---
id: test
name: Test
---

## extract

\`\`\`js
return {};
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toContain("Missing or empty 'hosts' array in frontmatter");
    });

    it("extractorがない場合はエラー", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

# No extractor here
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toContain(
        "At least one extractor (## heading + ```js code block) is required",
      );
    });

    it("コードブロックがないheadingはスキップされる", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

## noCode
No code block here

## hasCode

\`\`\`js
return "ok";
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(1);
      expect(result.skill.extractors[0].id).toBe("has-code");
    });

    it("空のコードブロックはエラー", () => {
      const markdown = `---
id: test
name: Test
hosts:
  - example.com
---

## emptyCode

\`\`\`js

\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors).toContain('Extractor "empty-code" has empty code block');
    });

    it("複数のエラーを一度に報告できる", () => {
      const markdown = `---
paths:
  - /test
---

# No extractors
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain("Missing or empty 'id' in frontmatter");
      expect(result.errors).toContain("Missing or empty 'name' in frontmatter");
      expect(result.errors).toContain("Missing or empty 'hosts' array in frontmatter");
    });
  });
});
