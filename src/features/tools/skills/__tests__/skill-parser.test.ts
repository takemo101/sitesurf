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

  describe("instruction layer", () => {
    it("# Instructions だけの skill を instructionsMarkdown 付きでパースできる", () => {
      const markdown = `---
id: github-guidance
name: GitHub Guidance
scope: global
version: 0.1.0
---

# Instructions

GitHub では task に応じて API / DOM のどれが最適かを先に判断すること。
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(0);
      expect(result.skill.instructionsMarkdown).toContain("GitHub では task に応じて");
      expect(result.skill.instructionsMarkdown?.endsWith("\n")).toBe(false);
    });

    it("# Instructions と # Extractors が両方ある skill をパースできる", () => {
      const markdown = `---
id: github-repo-analyzer
name: GitHub Repo Analyzer
scope: global
version: 0.2.0
---

# Instructions

## Always
GitHub pages may have CSP limitations.

## Task: Repository Analysis
repo 全体の分析では DOM extractor を万能手段として扱わない。

# Extractors

## Get Visible File List
<!-- extractor-id: getVisibleFileList -->
<!-- output-schema: { files: string[] } -->
現在表示中のファイル一覧だけを取得する。

\`\`\`js
function () {
  return { files: [] };
}
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(1);
      expect(result.skill.extractors[0].id).toBe("getVisibleFileList");
      expect(result.skill.instructionsMarkdown).toContain("GitHub pages may have CSP limitations.");
      expect(result.skill.instructionsMarkdown).toContain("repo 全体の分析では");
      // Instructions セクションに Extractors 見出しの中身が混入していないこと
      expect(result.skill.instructionsMarkdown).not.toContain("getVisibleFileList");
    });

    it("旧形式 (section marker なし) の skill には instructionsMarkdown が付かない", () => {
      const markdown = `---
id: youtube
name: YouTube
hosts:
  - youtube.com
---

## videoInfo

タイトルを取得する。

\`\`\`js
return { title: document.title };
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.instructionsMarkdown).toBeUndefined();
      expect(result.skill.extractors).toHaveLength(1);
    });

    it("instruction も extractor も空ならエラー", () => {
      const markdown = `---
id: empty-skill
name: Empty Skill
scope: global
---

# Instructions

# Extractors
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.errors.join(" ")).toMatch(/either an '# Instructions'/);
    });

    it("コードブロック内の # Instructions は section marker として扱わない", () => {
      const markdown = `---
id: yt
name: YT
hosts:
  - youtube.com
---

## sample

\`\`\`js
// # Instructions should not be a section here
return document.title;
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(1);
      expect(result.skill.instructionsMarkdown).toBeUndefined();
    });

    it("## Instructions は section marker として扱わない (top-level のみ認識)", () => {
      const markdown = `---
id: yt
name: YT
hosts:
  - youtube.com
---

## Instructions

\`\`\`js
return { note: "this heading should be treated as an extractor heading" };
\`\`\`
`;
      const result = parseSkillMarkdown(markdown);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // '## Instructions' は top-level section marker ではなく extractor heading として扱われる
      expect(result.skill.extractors).toHaveLength(1);
      expect(result.skill.extractors[0].id).toBe("instructions");
      expect(result.skill.instructionsMarkdown).toBeUndefined();
    });
  });
});
