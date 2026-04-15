import { describe, expect, it } from "vitest";
import { formatSkillsForSandbox, detectUsedSkills } from "../repl";
import { SkillRegistry } from "../skills";
import type { SkillMatch } from "../skills/types";

describe("formatSkillsForSandbox", () => {
  it("空のマッチ配列では空オブジェクトを返す", () => {
    const result = formatSkillsForSandbox([]);
    expect(result).toEqual({});
  });

  it("SkillMatchをサンドボックス用の形式に変換する", () => {
    const matches: SkillMatch[] = [
      {
        skill: {
          id: "youtube",
          name: "YouTube",
          description: "YouTube動画ページの情報抽出",
          matchers: { hosts: ["youtube.com"] },
          version: "0.0.0",
          extractors: [
            {
              id: "videoInfo",
              name: "動画情報",
              description: "タイトル取得",
              code: "function () { return document.title; }",
              outputSchema: "string",
            },
          ],
        },
        availableExtractors: [
          {
            id: "videoInfo",
            name: "動画情報",
            description: "タイトル取得",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
        confidence: 0,
      },
    ];

    const result = formatSkillsForSandbox(matches);

    expect(result.youtube).toBeDefined();
    expect(result.youtube.name).toBe("YouTube");
    expect(result.youtube.extractors.videoInfo).toBeDefined();
    expect(result.youtube.extractors.videoInfo.code).toBe("function () { return document.title; }");
    expect(result.youtube.extractors.videoInfo.name).toBe("動画情報");
    expect(result.youtube.extractors.videoInfo.outputSchema).toBe("string");
  });

  it("availableExtractorsのみがサンドボックスに含まれる", () => {
    const matches: SkillMatch[] = [
      {
        skill: {
          id: "test",
          name: "Test",
          description: "test",
          matchers: { hosts: ["test.com"] },
          version: "0.0.0",
          extractors: [
            {
              id: "ext1",
              name: "E1",
              description: "d1",
              selector: "present",
              code: "function () { return 1; }",
              outputSchema: "number",
            },
            {
              id: "ext2",
              name: "E2",
              description: "d2",
              selector: "missing",
              code: "function () { return 2; }",
              outputSchema: "number",
            },
          ],
        },
        availableExtractors: [
          {
            id: "ext1",
            name: "E1",
            description: "d1",
            selector: "present",
            code: "function () { return 1; }",
            outputSchema: "number",
          },
        ],
        confidence: 0,
      },
    ];

    const result = formatSkillsForSandbox(matches);
    expect(Object.keys(result.test.extractors)).toEqual(["ext1"]);
  });

  it("複数のSkillMatchを変換する", () => {
    const matches: SkillMatch[] = [
      {
        skill: {
          id: "a",
          name: "A",
          description: "da",
          matchers: { hosts: ["a.com"] },
          version: "0.0.0",
          extractors: [],
        },
        availableExtractors: [],
        confidence: 0,
      },
      {
        skill: {
          id: "b",
          name: "B",
          description: "db",
          matchers: { hosts: ["b.com"] },
          version: "0.0.0",
          extractors: [],
        },
        availableExtractors: [],
        confidence: 0,
      },
    ];

    const result = formatSkillsForSandbox(matches);
    expect(Object.keys(result)).toEqual(["a", "b"]);
  });
});

describe("detectUsedSkills", () => {
  const matches: SkillMatch[] = [
    {
      skill: {
        id: "dom-mutation",
        name: "DOM Mutation",
        description: "DOM改変スキル",
        scope: "global",
        matchers: { hosts: [] },
        version: "1.0.0",
        extractors: [
          {
            id: "hide-cookie-modal",
            name: "hideCookieModal",
            description: "クッキーモーダルを非表示",
            code: "function () { return {}; }",
            outputSchema: "unknown",
          },
          {
            id: "highlight-targets",
            name: "highlightTargets",
            description: "主要要素をハイライト",
            code: "function () { return {}; }",
            outputSchema: "unknown",
          },
        ],
      },
      availableExtractors: [
        {
          id: "hide-cookie-modal",
          name: "hideCookieModal",
          description: "クッキーモーダルを非表示",
          code: "function () { return {}; }",
          outputSchema: "unknown",
        },
        {
          id: "highlight-targets",
          name: "highlightTargets",
          description: "主要要素をハイライト",
          code: "function () { return {}; }",
          outputSchema: "unknown",
        },
      ],
      confidence: 100,
    },
    {
      skill: {
        id: "youtube",
        name: "YouTube",
        description: "YouTube情報抽出",
        matchers: { hosts: ["youtube.com"] },
        version: "1.0.0",
        extractors: [
          {
            id: "video-info",
            name: "Video Info",
            description: "動画情報取得",
            code: "function () { return {}; }",
            outputSchema: "unknown",
          },
        ],
      },
      availableExtractors: [
        {
          id: "video-info",
          name: "Video Info",
          description: "動画情報取得",
          code: "function () { return {}; }",
          outputSchema: "unknown",
        },
      ],
      confidence: 85,
    },
  ];

  it("コードにスキルIDが含まれる場合、使用スキルを検出する", () => {
    const code = `
      const code = skills["dom-mutation"].extractors["hide-cookie-modal"].code;
      const fn = new Function(\`return (\${code})\`)();
      await browserjs(fn);
    `;
    const result = detectUsedSkills(code, matches);
    expect(result).toHaveLength(1);
    expect(result[0].skillId).toBe("dom-mutation");
    expect(result[0].skillName).toBe("DOM Mutation");
    expect(result[0].extractorIds).toEqual(["hide-cookie-modal"]);
  });

  it("複数のextractorが使われる場合すべて検出する", () => {
    const code = `
      const c1 = skills["dom-mutation"].extractors["hide-cookie-modal"].code;
      const c2 = skills["dom-mutation"].extractors["highlight-targets"].code;
    `;
    const result = detectUsedSkills(code, matches);
    expect(result).toHaveLength(1);
    expect(result[0].extractorIds).toEqual(["hide-cookie-modal", "highlight-targets"]);
  });

  it("スキルIDが含まれない場合は空配列を返す", () => {
    const code = "return document.title;";
    const result = detectUsedSkills(code, matches);
    expect(result).toHaveLength(0);
  });

  it("skillMatchesが未定義の場合は空配列を返す", () => {
    const result = detectUsedSkills("some code", undefined);
    expect(result).toHaveLength(0);
  });

  it("skillMatchesが空の場合は空配列を返す", () => {
    const result = detectUsedSkills("some code", []);
    expect(result).toHaveLength(0);
  });
});

describe("SkillRegistry", () => {
  it("SkillRegistryは手動でSkillを登録できる", () => {
    const registry = new SkillRegistry();
    registry.register({
      id: "youtube",
      name: "YouTube",
      description: "YouTube動画ページの情報抽出",
      matchers: {
        hosts: ["youtube.com", "youtu.be"],
        paths: ["/watch"],
      },
      version: "0.0.0",
      extractors: [
        {
          id: "videoInfo",
          name: "Video Information",
          description: "タイトル、チャンネル名を取得",
          code: "function () { return document.title; }",
          outputSchema: "string",
        },
      ],
    });

    expect(registry.get("youtube")).toBeDefined();
    expect(registry.getAll()).toHaveLength(1);
  });

  it("YouTubeスキルがyoutube.comにマッチする", () => {
    const registry = new SkillRegistry();
    registry.register({
      id: "youtube",
      name: "YouTube",
      description: "YouTube動画ページの情報抽出",
      matchers: {
        hosts: ["youtube.com", "youtu.be"],
        paths: ["/watch"],
      },
      version: "0.0.0",
      extractors: [
        {
          id: "videoInfo",
          name: "Video Information",
          description: "タイトル、チャンネル名を取得",
          code: "function () { return document.title; }",
          outputSchema: "string",
        },
      ],
    });

    const matches = registry.findMatchingSkills("https://www.youtube.com/watch?v=abc123");
    expect(matches.length).toBe(1);
    expect(matches[0].skill.id).toBe("youtube");
  });

  it("Google検索スキルがgoogle.comにマッチする", () => {
    const registry = new SkillRegistry();
    registry.register({
      id: "google-search",
      name: "Google Search",
      description: "Google検索結果ページの情報抽出",
      matchers: {
        hosts: ["google.com", "google.co.jp"],
        paths: ["/search"],
      },
      version: "0.0.0",
      extractors: [
        {
          id: "searchResults",
          name: "Search Results",
          description: "検索結果を取得",
          code: "function () { return []; }",
          outputSchema: "array",
        },
      ],
    });

    const matches = registry.findMatchingSkills("https://www.google.com/search?q=test");
    expect(matches.length).toBe(1);
    expect(matches[0].skill.id).toBe("google-search");
  });

  it("Google検索スキルがgoogle.co.jpにマッチする", () => {
    const registry = new SkillRegistry();
    registry.register({
      id: "google-search",
      name: "Google Search",
      description: "Google検索結果ページの情報抽出",
      matchers: {
        hosts: ["google.com", "google.co.jp"],
        paths: ["/search"],
      },
      version: "0.0.0",
      extractors: [
        {
          id: "searchResults",
          name: "Search Results",
          description: "検索結果を取得",
          code: "function () { return []; }",
          outputSchema: "array",
        },
      ],
    });

    const matches = registry.findMatchingSkills("https://www.google.co.jp/search?q=test");
    expect(matches.length).toBe(1);
    expect(matches[0].skill.id).toBe("google-search");
  });

  it("関係ないURLにはマッチしない", () => {
    const registry = new SkillRegistry();
    registry.register({
      id: "youtube",
      name: "YouTube",
      description: "YouTube動画ページの情報抽出",
      matchers: {
        hosts: ["youtube.com"],
        paths: ["/watch"],
      },
      version: "0.0.0",
      extractors: [],
    });

    const matches = registry.findMatchingSkills("https://example.com/page");
    expect(matches.length).toBe(0);
  });
});
