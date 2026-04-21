import { describe, expect, it } from "vitest";
import { SkillRegistry } from "../registry";
import type { Skill } from "../types";

function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "テスト用Skill",
    matchers: {
      hosts: ["example.com"],
    },
    extractors: [
      {
        id: "extract1",
        name: "Extractor 1",
        description: "テスト抽出",
        code: "function () { return document.title; }",
        outputSchema: "string",
      },
    ],
    version: "1.0.0",
    ...overrides,
  };
}

describe("SkillRegistry", () => {
  describe("register / get", () => {
    it("登録したSkillをIDで取得できる", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill();
      registry.register(skill);

      expect(registry.get("test-skill")).toBe(skill);
    });

    it("未登録のIDはundefinedを返す", () => {
      const registry = new SkillRegistry();
      expect(registry.get("nonexistent")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("登録済み全Skillを返す", () => {
      const registry = new SkillRegistry();
      const skill1 = createTestSkill({ id: "skill-1" });
      const skill2 = createTestSkill({ id: "skill-2" });
      registry.register(skill1);
      registry.register(skill2);

      expect(registry.getAll()).toEqual([skill1, skill2]);
    });

    it("空のregistryは空配列を返す", () => {
      const registry = new SkillRegistry();
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe("findMatchingSkills", () => {
    it("ホスト名が完全一致するSkillを返す", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill({ matchers: { hosts: ["example.com"] } });
      registry.register(skill);

      const matches = registry.findMatchingSkills("https://example.com/page");
      expect(matches).toHaveLength(1);
      expect(matches[0].skill).toBe(skill);
    });

    it("サブドメインでもマッチする", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill({ matchers: { hosts: ["example.com"] } });
      registry.register(skill);

      const matches = registry.findMatchingSkills("https://www.example.com/page");
      expect(matches).toHaveLength(1);
    });

    it("ホスト名が異なる場合はマッチしない", () => {
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ matchers: { hosts: ["example.com"] } }));

      const matches = registry.findMatchingSkills("https://other.com/page");
      expect(matches).toHaveLength(0);
    });

    it("paths指定がある場合、パスがマッチしないとスキップ", () => {
      const registry = new SkillRegistry();
      registry.register(
        createTestSkill({
          matchers: { hosts: ["example.com"], paths: ["/watch"] },
        }),
      );

      const noMatch = registry.findMatchingSkills("https://example.com/about");
      expect(noMatch).toHaveLength(0);

      const match = registry.findMatchingSkills("https://example.com/watch?v=abc");
      expect(match).toHaveLength(1);
    });

    it("paths指定がない場合、ホストマッチのみで成功", () => {
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ matchers: { hosts: ["example.com"] } }));

      const matches = registry.findMatchingSkills("https://example.com/any/path");
      expect(matches).toHaveLength(1);
    });

    it("マッチ結果にavailableExtractorsが含まれる", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill();
      registry.register(skill);

      const matches = registry.findMatchingSkills("https://example.com/");
      expect(matches[0].availableExtractors).toEqual(skill.extractors);
    });

    it("複数Skillがマッチする場合、すべて返す", () => {
      const registry = new SkillRegistry();
      registry.register(createTestSkill({ id: "s1", matchers: { hosts: ["example.com"] } }));
      registry.register(createTestSkill({ id: "s2", matchers: { hosts: ["example.com"] } }));

      const matches = registry.findMatchingSkills("https://example.com/");
      expect(matches).toHaveLength(2);
    });

    it("global skill は URL に依存せず別取得できる", () => {
      const registry = new SkillRegistry();
      registry.register(
        createTestSkill({
          id: "global-skill",
          scope: "global",
          matchers: { hosts: [] },
        }),
      );

      const siteMatches = registry.findMatchingSkills("https://example.com/");
      const globalMatches = registry.getGlobalSkills();

      expect(siteMatches).toHaveLength(0);
      expect(globalMatches).toHaveLength(1);
      expect(globalMatches[0].skill.id).toBe("global-skill");
    });
  });
});

describe("calculateConfidence", () => {
  it("ホスト+パスなし+DOMなしで85点", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({ matchers: { hosts: ["example.com"] } });
    registry.register(skill);

    const confidence = registry.calculateConfidence(skill, "https://example.com/page");
    expect(confidence).toBe(85);
  });

  it("ホスト+パスあり+DOMなしで85点", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({
      matchers: { hosts: ["example.com"], paths: ["/watch"] },
    });
    registry.register(skill);

    const confidence = registry.calculateConfidence(skill, "https://example.com/watch?v=abc");
    expect(confidence).toBe(85);
  });

  it("ホスト不一致で30点（パス+DOM部分点のみ）", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({ matchers: { hosts: ["other.com"] } });
    registry.register(skill);

    const confidence = registry.calculateConfidence(skill, "https://example.com/page");
    expect(confidence).toBe(45);
  });

  it("DOMインジケータ全部一致で100点", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({
      matchers: { hosts: ["example.com"], paths: ["/page"] },
      metadata: {
        domIndicators: {
          selectors: ["h1.title", "div.content"],
          requiredText: ["Example"],
          minElements: 2,
        },
      },
    });
    registry.register(skill);

    const snapshot = {
      elements: { "h1.title": 1, "div.content": 3 },
      texts: ["Example Domain", "Welcome"],
    };

    const confidence = registry.calculateConfidence(skill, "https://example.com/page", snapshot);
    expect(confidence).toBe(100);
  });

  it("DOMセレクタ一部不一致", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({
      matchers: { hosts: ["example.com"] },
      metadata: {
        domIndicators: {
          selectors: ["h1.title", "div.missing"],
        },
      },
    });
    registry.register(skill);

    const snapshot = {
      elements: { "h1.title": 1 },
      texts: [],
    };

    const confidence = registry.calculateConfidence(skill, "https://example.com/page", snapshot);
    // host=40, path=30(no paths), DOM=10(one of two selectors matched, 50% of 20)
    expect(confidence).toBe(80);
  });

  it("DOM requiredText一部不一致", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({
      matchers: { hosts: ["example.com"] },
      metadata: {
        domIndicators: {
          selectors: ["h1"],
          requiredText: ["hello", "world"],
          minElements: 5,
        },
      },
    });
    registry.register(skill);

    const snapshot = {
      elements: { h1: 1 },
      texts: ["hello there"],
    };

    const confidence = registry.calculateConfidence(skill, "https://example.com/page", snapshot);
    // host=40, path=30, DOM=20(selectors matched)+2.5(one of two texts)+0(minElements not met)
    expect(confidence).toBe(92.5);
  });
});

describe("findMatchingSkills with confidence", () => {
  it("結果にconfidenceが含まれる", () => {
    const registry = new SkillRegistry();
    registry.register(createTestSkill({ matchers: { hosts: ["example.com"] } }));

    const matches = registry.findMatchingSkills("https://example.com/");
    expect(matches[0]).toHaveProperty("confidence");
    expect(matches[0].confidence).toBe(85);
  });

  it("confidenceで降順ソートされる", () => {
    const registry = new SkillRegistry();
    registry.register(
      createTestSkill({
        id: "low",
        matchers: { hosts: ["example.com"], paths: ["/specific"] },
      }),
    );
    registry.register(
      createTestSkill({
        id: "high",
        matchers: { hosts: ["example.com"] },
      }),
    );

    const matches = registry.findMatchingSkills("https://example.com/other");
    // "high" has no path restriction (85pts), "low" has path that doesn't match (40pts, filtered)
    expect(matches[0].skill.id).toBe("high");
  });

  it("minConfidence閾値でフィルタリングされる", () => {
    const registry = new SkillRegistry();
    registry.register(createTestSkill({ matchers: { hosts: ["example.com"] } }));

    // Default minConfidence=50, score=85 -> passes
    const matches50 = registry.findMatchingSkills("https://example.com/", undefined, 50);
    expect(matches50).toHaveLength(1);

    // minConfidence=90, score=85 -> filtered
    const matches90 = registry.findMatchingSkills("https://example.com/", undefined, 90);
    expect(matches90).toHaveLength(0);
  });

  it("DOM snapshotが渡されてconfidenceが上昇する", () => {
    const registry = new SkillRegistry();
    const skill = createTestSkill({
      matchers: { hosts: ["example.com"], paths: ["/page"] },
      metadata: {
        domIndicators: {
          selectors: ["h1"],
          requiredText: ["Hello"],
          minElements: 1,
        },
      },
    });
    registry.register(skill);

    const withoutDom = registry.findMatchingSkills("https://example.com/page");
    const withDom = registry.findMatchingSkills("https://example.com/page", {
      elements: { h1: 1 },
      texts: ["Hello World"],
    });

    expect(withDom[0].confidence).toBeGreaterThan(withoutDom[0].confidence);
  });

  describe("activation level", () => {
    it("host-only match (no matchers.paths) は passive として返る", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill({
        id: "github-broad",
        matchers: { hosts: ["github.com"] },
      });
      registry.register(skill);

      const matches = registry.findMatchingSkills("https://github.com/owner/repo");
      expect(matches).toHaveLength(1);
      expect(matches[0].activationLevel).toBe("passive");
    });

    it("paths が定義されている skill は path 一致時に contextual として返る", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill({
        id: "github-tree",
        matchers: { hosts: ["github.com"], paths: ["/*/*/tree/**"] },
      });
      registry.register(skill);

      const matches = registry.findMatchingSkills("https://github.com/owner/repo/tree/main");
      expect(matches).toHaveLength(1);
      expect(matches[0].activationLevel).toBe("contextual");
    });

    it("同じ host-scoped skill に path 一致 / 不一致 の URL があると contextual / 非対象に分かれる", () => {
      const registry = new SkillRegistry();
      const treeSkill = createTestSkill({
        id: "github-tree",
        matchers: { hosts: ["github.com"], paths: ["/*/*/tree/**"] },
      });
      registry.register(treeSkill);

      const onTree = registry.findMatchingSkills("https://github.com/owner/repo/tree/main");
      const onIssue = registry.findMatchingSkills("https://github.com/owner/repo/issues/123");

      expect(onTree.map((m) => m.skill.id)).toEqual(["github-tree"]);
      expect(onTree[0].activationLevel).toBe("contextual");
      // path が合わないと registry レベルで除外される → 過剰な activation を未然に防ぐ
      expect(onIssue).toEqual([]);
    });

    it("global skill は常に passive として返る", () => {
      const registry = new SkillRegistry();
      const skill = createTestSkill({
        id: "dom-mutation",
        scope: "global",
        matchers: { hosts: [] },
      });
      registry.register(skill);

      const matches = registry.getGlobalSkills();
      expect(matches).toHaveLength(1);
      expect(matches[0].activationLevel).toBe("passive");
    });
  });
});
