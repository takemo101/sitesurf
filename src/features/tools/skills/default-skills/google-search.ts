import type { Skill } from "@/shared/skill-types";

export const googleSearchSkill: Skill = {
  id: "google-search",
  version: "1.0.0",
  name: "Google Search Results",
  description: "Google検索結果ページの情報抽出",
  matchers: {
    hosts: ["google.com", "www.google.com", "google.co.jp"],
    paths: ["/search"],
  },
  extractors: [
    {
      id: "getResults",
      name: "検索結果取得",
      description: "検索結果のタイトル、URL、スニペットを取得",
      code: `function() {
        const results = Array.from(document.querySelectorAll("#search .g, #rso .g, [data-result-index]"));
        return results.map((el, i) => {
          const titleEl = el.querySelector("h3");
          const linkEl = el.querySelector("a[href]");
          const snippetEl = el.querySelector("[data-sncf], .VwiC3b, .s3v94d, .st, .LyiQHf");
          return {
            position: i + 1,
            title: titleEl?.textContent?.trim() || null,
            url: linkEl?.href || null,
            snippet: snippetEl?.textContent?.trim() || null,
          };
        }).filter(r => r.title);
      }`,
      outputSchema:
        "Array<{ position: number, title: string | null, url: string | null, snippet: string | null }>",
    },
    {
      id: "getFeaturedSnippet",
      name: "特設スニペット取得",
      description: "検索結果上部の回答ボックス（フィーチャードスニペット）を取得",
      code: `function() {
        const selectors = [
          ".xpdopen .VwiC3b",
          ".xpdopen .LGOjhe",
          "[data-featured-snippet] .VwiC3b",
          ".IZ6rdc",
          ".s3v94d-AyKMt",
          ".hgKElc",
          ".V6Cfzd",
        ];
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el?.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
        return null;
      }`,
      outputSchema: "string | null",
    },
    {
      id: "getRelatedSearches",
      name: "関連検索取得",
      description: "ページ下部の関連検索キーワードを取得",
      code: `function() {
        const relatedSelectors = [
          "#bres .BVG0Nb",
          "#brs .gGQDvd",
          "[data-related-queries] a",
          ".Y3iVnd",
          "#botstuff a[href*="/search"]",
        ];
        const keywords = [];
        for (const selector of relatedSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent?.trim();
            if (text && !keywords.includes(text)) {
              keywords.push(text);
            }
          }
        }
        return keywords;
      }`,
      outputSchema: "string[]",
    },
  ],
};
