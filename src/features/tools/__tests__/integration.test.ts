import { describe, expect, it } from "vitest";
import {
  executeReadPage,
  readPageToolDef,
  bgFetchToolDef,
  createToolExecutorWithSkills,
  ALL_TOOL_DEFS,
  AGENT_TOOL_DEFS,
  getAgentToolDefs,
} from "../index";
import { SkillRegistry, type SkillMatch } from "../skills";
import type { BrowserExecutor, PageContent } from "@/ports/browser-executor";
import { ok } from "@/shared/errors";
import { InMemoryArtifactStorage, InMemoryStorage } from "@/adapters/storage/in-memory-storage";

function createToolExecutor(name: string, args: Record<string, unknown>, browser: BrowserExecutor) {
  return createToolExecutorWithSkills(
    new SkillRegistry(),
    new InMemoryArtifactStorage(),
    new InMemoryStorage(),
  )(name, args, browser);
}

function createMockBrowser(overrides: Partial<BrowserExecutor> = {}): BrowserExecutor {
  return {
    getActiveTab: async () => ({ id: 1, url: "https://example.com", title: "Example" }),
    openTab: async () => 1,
    navigateTo: async () => ok({ url: "", title: "" }),
    captureScreenshot: async () => "",
    onTabActivated: () => () => {},
    onTabUpdated: () => () => {},
    onTabRemoved: () => () => {},
    readPageContent: async () => ok({ text: "", simplifiedDom: "" }),
    executeScript: async () => ok({ value: undefined }),
    injectElementPicker: async () => ok(null),
    ...overrides,
  };
}

// Helper to create a registry with test skills
function createTestRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  // Add test skills inline
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
        description: "タイトル、チャンネル名、説明文、再生回数を取得",
        code: `function () {
          const title = document.querySelector('h1')?.textContent?.trim();
          const channel = document.querySelector('#channel-name')?.textContent?.trim();
          return { title, channel };
        }`,
        outputSchema: "{ title: string, channel: string }",
      },
    ],
  });
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
        description: "検索結果の順位、タイトル、URL、スニペットを取得",
        code: `function () {
          return Array.from(document.querySelectorAll('#search .g')).map((el, i) => ({
            position: i + 1,
            title: el.querySelector('h3')?.textContent?.trim(),
          })).filter(r => r.title);
        }`,
        outputSchema: "Array<{ position: number, title: string }>",
      },
    ],
  });
  return registry;
}

describe("2段階抽出ワークフロー", () => {
  describe("Stage 1: read_page で軽量抽出", () => {
    it("プレーンテキストとメタ情報を返す", async () => {
      const browser = createMockBrowser({
        readPageContent: async () =>
          ok({
            text: "記事の本文テキスト",
            simplifiedDom: "[Extraction: article]\nMeta: description\n\n記事の本文テキスト",
          }),
      });

      const result = await executeReadPage(browser, {});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.text).toBe("記事の本文テキスト");
      expect(result.value.simplifiedDom).toContain("Extraction:");
    });

    it("長いコンテンツは切り詰められる（トークン削減）", async () => {
      const longText = "あ".repeat(10_000);
      const browser = createMockBrowser({
        readPageContent: async () => ok({ text: longText, simplifiedDom: "" }),
      });

      const result = await executeReadPage(browser, {});
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.text.length).toBeLessThan(longText.length);
    });
  });

  describe("Stage 2: repl で精密抽出（ToolExecutor経由）", () => {
    it("createToolExecutor が read_page をディスパッチする", async () => {
      const browser = createMockBrowser({
        readPageContent: async () => ok({ text: "概要テキスト", simplifiedDom: "" }),
      });

      const result = await createToolExecutor("read_page", {}, browser);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const content = result.value as PageContent;
      expect(content.text).toBe("概要テキスト");
    });

    it("未知のツール名はエラーを返す", async () => {
      const browser = createMockBrowser();
      const result = await createToolExecutor("unknown_tool", {}, browser);
      expect(result.ok).toBe(false);
    });
  });

  describe("ツール定義の整合性", () => {
    it("全ツール定義が一意の name を持つ", () => {
      const names = ALL_TOOL_DEFS.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("read_page の description が軽量抽出と1行の repl 誘導のみを含む", () => {
      expect(readPageToolDef.description).toContain("軽量");
      expect(readPageToolDef.description).toContain("複数ページを跨ぐ場合は `repl` で loop 制御する。");
      expect(readPageToolDef.description).not.toContain("artifact");
      expect(readPageToolDef.description).not.toContain("```javascript");
    });

    it("bg_fetch の description が SSOT として詳細な使い分けを保持する", () => {
      expect(bgFetchToolDef.description).toContain("repl 内 helper の bgFetch() も同じ使い分けに従う");
      expect(bgFetchToolDef.description).toContain("5URL以上を取得する場合");
      expect(bgFetchToolDef.description).toContain("createOrUpdateArtifact()");
      expect(bgFetchToolDef.description).toContain("MAX_TURNS");
    });

    it("全ツール定義が parameters.type を持つ", () => {
      for (const def of ALL_TOOL_DEFS) {
        const params = def.parameters as Record<string, unknown>;
        expect(params.type).toBe("object");
      }
    });

    it("agent に公開する tool 定義から skill 管理ツールを除外する", () => {
      const names = AGENT_TOOL_DEFS.map((t) => t.name);

      expect(names).toContain("skill");
      expect(names).not.toContain("list_skill_drafts");
      expect(names).not.toContain("create_skill_draft");
      expect(names).not.toContain("update_skill_draft");
      expect(names).not.toContain("delete_skill_draft");
    });

    it("getAgentToolDefs: 引数なしで bg_fetch を除外する", () => {
      const names = getAgentToolDefs().map((t) => t.name);
      expect(names).not.toContain("bg_fetch");
      expect(names).not.toContain("get_tool_result");
      expect(names).toContain("skill");
    });

    it("getAgentToolDefs: enableBgFetch=false で bg_fetch を除外する", () => {
      const names = getAgentToolDefs({ enableBgFetch: false }).map((t) => t.name);
      expect(names).not.toContain("bg_fetch");
    });

    it("getAgentToolDefs: enableBgFetch=true で bg_fetch を含む", () => {
      const names = getAgentToolDefs({ enableBgFetch: true }).map((t) => t.name);
      expect(names).toContain("bg_fetch");
      expect(names).not.toContain("get_tool_result");
      expect(names).toContain("skill");
    });

  });

  describe("draft ツールの dispatch パス", () => {
    it("skill(action=list_drafts) が executor 経由で実行できる", async () => {
      const browser = createMockBrowser();
      const result = await createToolExecutor("skill", { action: "list_drafts" }, browser);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveProperty("drafts");
    });

    it("skill(action=create_draft) が executor 経由で実行できる", async () => {
      const browser = createMockBrowser();
      const result = await createToolExecutor(
        "skill",
        {
          action: "create_draft",
          data: {
            name: "Integration Draft",
            description: "Created via executor dispatch",
            matchers: { hosts: ["example.com"] },
            extractors: [
              {
                id: "getTitle",
                name: "Get Title",
                description: "Return the page title",
                code: "function () { return document.title; }",
                outputSchema: "string",
              },
            ],
          },
        },
        browser,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveProperty("draftId");
    });

    it("skill(action=update_draft) が executor 経由で実行できる", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const browser = createMockBrowser();
      const executor = createToolExecutorWithSkills(
        registry,
        new InMemoryArtifactStorage(),
        storage,
      );

      const createResult = await executor(
        "skill",
        {
          action: "create_draft",
          data: {
            name: "Draft For Update",
            description: "Will be updated via dispatch",
            matchers: { hosts: ["example.com"] },
            extractors: [
              {
                id: "getTitle",
                name: "Get Title",
                description: "Return the page title",
                code: "function () { return document.title; }",
                outputSchema: "string",
              },
            ],
          },
        },
        browser,
      );
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;
      const draftId = (createResult.value as { draftId: string }).draftId;

      const updateResult = await executor(
        "skill",
        { action: "update_draft", id: draftId, updates: { description: "Updated via dispatch" } },
        browser,
      );
      expect(updateResult.ok).toBe(true);
      if (!updateResult.ok) return;
      expect(
        (updateResult.value as { normalizedSkill: { description: string } }).normalizedSkill
          .description,
      ).toBe("Updated via dispatch");
    });

    it("skill(action=delete_draft) が executor 経由で実行できる", async () => {
      const storage = new InMemoryStorage();
      const registry = new SkillRegistry();
      const browser = createMockBrowser();
      const executor = createToolExecutorWithSkills(
        registry,
        new InMemoryArtifactStorage(),
        storage,
      );

      const createResult = await executor(
        "skill",
        {
          action: "create_draft",
          data: {
            name: "Draft For Delete",
            description: "Will be deleted via dispatch",
            matchers: { hosts: ["example.com"] },
            extractors: [
              {
                id: "getTitle",
                name: "Get Title",
                description: "Return the page title",
                code: "function () { return document.title; }",
                outputSchema: "string",
              },
            ],
          },
        },
        browser,
      );
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;
      const draftId = (createResult.value as { draftId: string }).draftId;

      const deleteResult = await executor(
        "skill",
        { action: "delete_draft", id: draftId },
        browser,
      );
      expect(deleteResult.ok).toBe(true);
      if (!deleteResult.ok) return;
      expect(deleteResult.value).toEqual({ deleted: true, draftId });

      const listResult = await executor("skill", { action: "list_drafts" }, browser);
      expect(listResult.ok).toBe(true);
      if (!listResult.ok) return;
      expect((listResult.value as { drafts: unknown[] }).drafts).toEqual([]);
    });
  });
});

describe("Skills使用フロー", () => {
  describe("レジストリ生成とマッチング", () => {
    it("YouTube動画ページでSkillがマッチし、extractorsを取得できる", () => {
      const registry = createTestRegistry();
      const matches = registry.findMatchingSkills("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      expect(matches).toHaveLength(1);
      const match = matches[0];
      expect(match.skill.id).toBe("youtube");
      expect(match.availableExtractors.length).toBeGreaterThanOrEqual(1);

      const videoInfo = match.availableExtractors.find((e) => e.id === "videoInfo");
      expect(videoInfo).toBeDefined();
      expect(videoInfo!.code).toContain("title");
    });

    it("Google検索ページでSkillがマッチし、extractorsを取得できる", () => {
      const registry = createTestRegistry();
      const matches = registry.findMatchingSkills("https://www.google.com/search?q=tandemweb");

      expect(matches).toHaveLength(1);
      const match = matches[0];
      expect(match.skill.id).toBe("google-search");

      const searchResults = match.availableExtractors.find((e) => e.id === "searchResults");
      expect(searchResults).toBeDefined();
      expect(searchResults!.code).toContain("#search .g");
    });

    it("対応外サイトではマッチせず、空配列が返る", () => {
      const registry = createTestRegistry();
      const matches = registry.findMatchingSkills("https://unknown-site.example.com/page");
      expect(matches).toHaveLength(0);
    });
  });

  describe("2段階抽出 + Skills の統合フロー", () => {
    it("read_page → Skills検出 → extractor code取得 の流れが成立する", async () => {
      // Stage 1: read_page で軽量な概要を取得
      const browser = createMockBrowser({
        getActiveTab: async () => ({
          id: 1,
          url: "https://www.youtube.com/watch?v=abc123",
          title: "YouTube Video",
        }),
        readPageContent: async () =>
          ok({
            text: "YouTube Video\n\n動画の概要テキスト...",
            simplifiedDom: "[Extraction: ytd-watch-metadata]",
          }),
      });

      const readResult = await executeReadPage(browser, {});
      expect(readResult.ok).toBe(true);
      if (!readResult.ok) return;
      expect(readResult.value.text).toContain("YouTube Video");

      // Stage 2: URLからSkillsを検出し、extractor codeを取得
      const tab = await browser.getActiveTab();
      const registry = createTestRegistry();
      const matches = registry.findMatchingSkills(tab.url);

      expect(matches).toHaveLength(1);
      const youtubeMatch = matches[0];
      expect(youtubeMatch.skill.id).toBe("youtube");

      // extractorのcodeが存在し、replで実行可能な形式であることを確認
      const videoExtractor = youtubeMatch.availableExtractors.find((e) => e.id === "videoInfo");
      expect(videoExtractor).toBeDefined();
      expect(typeof videoExtractor!.code).toBe("string");
      expect(videoExtractor!.code.length).toBeGreaterThan(0);
    });
  });
});

describe("後方互換性", () => {
  it("PageContent に text と simplifiedDom の両フィールドが存在する", async () => {
    const browser = createMockBrowser({
      readPageContent: async () => ok({ text: "本文", simplifiedDom: "メタ情報" }),
    });

    const result = await executeReadPage(browser, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveProperty("text");
    expect(result.value).toHaveProperty("simplifiedDom");
  });

  it("simplifiedDom が空文字でもエラーにならない", async () => {
    const browser = createMockBrowser({
      readPageContent: async () => ok({ text: "本文のみ", simplifiedDom: "" }),
    });

    const result = await executeReadPage(browser, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe("本文のみ");
    expect(result.value.simplifiedDom).toBe("");
  });

  it("SkillMatch の型が skill と availableExtractors を持つ", () => {
    const registry = createTestRegistry();
    const matches: SkillMatch[] = registry.findMatchingSkills(
      "https://www.youtube.com/watch?v=test",
    );

    for (const match of matches) {
      expect(match).toHaveProperty("skill");
      expect(match).toHaveProperty("availableExtractors");
      expect(Array.isArray(match.availableExtractors)).toBe(true);
    }
  });
});
