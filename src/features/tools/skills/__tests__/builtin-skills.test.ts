import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseSkillMarkdown } from "../skill-parser";

// ビルトインSkillファイルの内容をファイルシステムから読み込む
const youtubeMarkdown = readFileSync(
  resolve(__dirname, "../../../../../public/skills/youtube.md"),
  "utf-8",
);
const googleSearchMarkdown = readFileSync(
  resolve(__dirname, "../../../../../public/skills/google-search.md"),
  "utf-8",
);
const domMutationMarkdown = readFileSync(
  resolve(__dirname, "../../../../../public/skills/dom-mutation.md"),
  "utf-8",
);
const githubGuidanceMarkdown = readFileSync(
  resolve(__dirname, "../../../../../public/skills/github-guidance.md"),
  "utf-8",
);

describe("Builtin Skills Markdown", () => {
  describe("youtube.md", () => {
    it("パースできる", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
    });

    it("正しいIDを持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("youtube");
    });

    it("正しい名前を持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.name).toBe("YouTube");
    });

    it("正しい説明文を持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.description).toBe("YouTube動画ページの情報抽出");
    });

    it("正しいホストを持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.matchers.hosts).toContain("youtube.com");
      expect(result.skill.matchers.hosts).toContain("youtu.be");
    });

    it("正しいパスを持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.matchers.paths).toContain("/watch");
    });

    it("2つのエクストラクターを持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(2);
    });

    it("videoInfoエクストラクターを持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((e) => e.id === "video-info");
      expect(extractor).toBeDefined();
      expect(extractor!.code).toContain("title");
      expect(extractor!.code).toContain("channel");
      expect(extractor!.code).toContain("description");
      expect(extractor!.code).toContain("viewCount");
    });

    it("commentsエクストラクターを持つ", () => {
      const result = parseSkillMarkdown(youtubeMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((e) => e.id === "comments");
      expect(extractor).toBeDefined();
      expect(extractor!.code).toContain("ytd-comment-renderer");
      expect(extractor!.code).toContain("slice(0, 5)");
    });
  });

  describe("google-search.md", () => {
    it("パースできる", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
    });

    it("正しいIDを持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("google-search");
    });

    it("正しい名前を持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.name).toBe("Google Search");
    });

    it("正しい説明文を持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.description).toBe("Google検索結果ページの情報抽出");
    });

    it("正しいホストを持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.matchers.hosts).toContain("google.com");
      expect(result.skill.matchers.hosts).toContain("google.co.jp");
    });

    it("正しいパスを持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.matchers.paths).toContain("/search");
    });

    it("1つのエクストラクターを持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(1);
    });

    it("searchResultsエクストラクターを持つ", () => {
      const result = parseSkillMarkdown(googleSearchMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((e) => e.id === "search-results");
      expect(extractor).toBeDefined();
      expect(extractor!.code).toContain("#search .g");
      expect(extractor!.code).toContain("position");
      expect(extractor!.code).toContain("title");
      expect(extractor!.code).toContain("url");
      expect(extractor!.code).toContain("snippet");
    });
  });

  describe("dom-mutation.md", () => {
    it("パースできる", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
    });

    it("global skill として解釈される", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("dom-mutation");
      expect(result.skill.scope).toBe("global");
      expect(result.skill.matchers.hosts).toEqual([]);
    });

    it("6つの改変 extractor を持つ", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.extractors).toHaveLength(6);
      expect(result.skill.extractors.map((extractor) => extractor.id)).toEqual([
        "hide-cookie-modal",
        "inject-helper-banner",
        "highlight-targets",
        "remove-sticky",
        "remove-overlays",
        "shuffle-list",
      ]);
    });

    it("hideCookieModal は汎用 dialog セレクタを含まない", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((item) => item.id === "hide-cookie-modal");
      expect(extractor).toBeDefined();
      expect(extractor?.code).not.toContain('[role="dialog"]');
      expect(extractor?.code).toContain('[id*="cookie"]');
    });

    it("hideCookieModal は同意バナーらしい要素だけを対象に絞る", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((item) => item.id === "hide-cookie-modal");
      expect(extractor).toBeDefined();
      expect(extractor?.code).toContain("consentTerms");
      expect(extractor?.code).toContain('style.position === "fixed"');
      expect(extractor?.code).toContain("isConsentLike");
    });

    it("removeSticky はセマンティック要素のみ対象で AND 条件でフィルタする", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((item) => item.id === "remove-sticky");
      expect(extractor).toBeDefined();
      expect(extractor?.code).toContain("isBannerLike");
      expect(extractor?.code).toContain("&&");
      expect(extractor?.code).not.toContain('"div"');
    });

    it("removeOverlays は hideCookieModal と重複しない用語を使い textContent を検査する", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((item) => item.id === "remove-overlays");
      expect(extractor).toBeDefined();
      expect(extractor?.code).toContain("textContent");
      expect(extractor?.code).toContain(">= 1000");
      expect(extractor?.code).not.toContain('"modal"');
      expect(extractor?.code).not.toContain('"overlay"');
      expect(extractor?.code).not.toContain('"popup"');
    });

    it("shuffleList は nav 内を除外し appendChild 方式でシャッフルする", () => {
      const result = parseSkillMarkdown(domMutationMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const extractor = result.skill.extractors.find((item) => item.id === "shuffle-list");
      expect(extractor).toBeDefined();
      expect(extractor?.code).toContain('closest("nav")');
      expect(extractor?.code).toContain("appendChild");
      expect(extractor?.code).not.toContain("insertBefore");
    });
  });

  describe("github-guidance.md (instruction-only)", () => {
    it("パースできる", () => {
      const result = parseSkillMarkdown(githubGuidanceMarkdown);
      expect(result.ok).toBe(true);
    });

    it("instruction-only skill として extractors を持たない", () => {
      const result = parseSkillMarkdown(githubGuidanceMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.id).toBe("github-guidance");
      expect(result.skill.extractors).toHaveLength(0);
    });

    it("instructionsMarkdown を保持する", () => {
      const result = parseSkillMarkdown(githubGuidanceMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.instructionsMarkdown).toContain("GitHub では task に応じて");
      expect(result.skill.instructionsMarkdown).toContain("Repository Analysis");
    });

    it("github.com を対象にした site-scoped skill として登録される", () => {
      const result = parseSkillMarkdown(githubGuidanceMarkdown);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.skill.matchers.hosts).toContain("github.com");
      // catch-all paths を使っていないため、host-only 扱いで passive に落ち着く想定。
      expect(result.skill.matchers.paths).toBeUndefined();
    });
  });
});
