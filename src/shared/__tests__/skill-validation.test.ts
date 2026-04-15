import { describe, expect, it } from "vitest";

import {
  isExtractorFunctionSource,
  normalizeLegacyExtractorCode,
  validateSkillDefinition,
  validateSkillDraftDefinition,
} from "../skill-validation";
import type { Skill } from "../skill-types";

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "A test skill description",
    matchers: { hosts: ["example.com"] },
    version: "1.0.0",
    extractors: [
      {
        id: "getTitle",
        name: "Get Title",
        description: "Get page title from the DOM",
        code: "function () { return document.title; }",
        outputSchema: "string",
      },
    ],
    ...overrides,
  };
}

describe("isExtractorFunctionSource", () => {
  it("anonymous function を受け入れる", () => {
    expect(isExtractorFunctionSource("function () { return 1; }")).toBe(true);
  });

  it("named function を受け入れる", () => {
    expect(isExtractorFunctionSource("function getTitle() { return document.title; }")).toBe(true);
  });

  it("async function を受け入れる", () => {
    expect(isExtractorFunctionSource("async function () { return 1; }")).toBe(true);
  });

  it("ネストした波括弧を正しく処理する", () => {
    expect(isExtractorFunctionSource("function () { if (true) { return 1; } return 0; }")).toBe(
      true,
    );
  });

  it("文字列内の波括弧を無視する", () => {
    expect(isExtractorFunctionSource('function () { return "}"; }')).toBe(true);
  });

  it("テンプレートリテラル内の波括弧を無視する", () => {
    expect(isExtractorFunctionSource("function () { return `{}`; }")).toBe(true);
  });

  it("コメント内の波括弧を無視する", () => {
    expect(isExtractorFunctionSource("function () { /* } */ return 1; }")).toBe(true);
  });

  it("bare code を拒否する", () => {
    expect(isExtractorFunctionSource("return document.title;")).toBe(false);
  });

  it("アロー関数を拒否する", () => {
    expect(isExtractorFunctionSource("() => { return 1; }")).toBe(false);
  });

  it("空文字列を拒否する", () => {
    expect(isExtractorFunctionSource("")).toBe(false);
  });

  it("波括弧が不一致のコードを拒否する", () => {
    expect(isExtractorFunctionSource("function () { if (true) { return 1; }")).toBe(false);
  });

  it("副作用を起こさない（CSP安全）", () => {
    const marker = "__isExtractorFunctionSource_test__";
    Reflect.deleteProperty(globalThis as Record<string, unknown>, marker);

    isExtractorFunctionSource(`function () { globalThis.${marker} = true; return 1; }`);

    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined();
  });
});

describe("normalizeLegacyExtractorCode", () => {
  it("function 形式はそのまま返す", () => {
    const code = "function () { return 1; }";
    expect(normalizeLegacyExtractorCode(code)).toBe(code);
  });

  it("bare code を function でラップする", () => {
    expect(normalizeLegacyExtractorCode("return document.title;")).toBe(
      "function () {\nreturn document.title;\n}",
    );
  });

  it("空文字列はそのまま返す", () => {
    expect(normalizeLegacyExtractorCode("")).toBe("");
  });

  it("二重ラップしない", () => {
    const code = "function () { return 1; }";
    const result = normalizeLegacyExtractorCode(code);
    expect(result).not.toContain("function () {\nfunction");
  });
});

describe("validateSkillDraftDefinition", () => {
  it("returns warning status for low-quality but valid drafts", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        description: "short",
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "short",
            code: "function () { document.title; }",
            outputSchema: "unknown",
          },
        ],
      }),
    );

    expect(result.status).toBe("warning");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns reject status when validation errors exist", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "goSomewhere",
            name: "Go Somewhere",
            description: "Navigate away from the page",
            code: 'window.location.assign("https://example.com")',
            outputSchema: "string",
          },
        ],
      }),
    );

    expect(result.status).toBe("reject");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts extractor code written as async function source", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Get page title from the DOM asynchronously",
            code: "async function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      }),
    );

    expect(result.status).toBe("ok");
  });

  it("rejects bare extractor bodies and asks for full function source", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Get page title from the DOM",
            code: "return document.title;",
            outputSchema: "string",
          },
        ],
      }),
    );

    expect(result.status).toBe("reject");
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("full function source"),
        }),
      ]),
    );
  });

  it("does not execute top-level expressions while checking function-source syntax", () => {
    const marker = "__skill_validation_side_effect__";
    Reflect.deleteProperty(globalThis as Record<string, unknown>, marker);

    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Get page title from the DOM",
            code: `(() => { globalThis.${marker} = true; return function () { return document.title; }; })()`,
            outputSchema: "string",
          },
        ],
      }),
    );

    expect(result.status).toBe("reject");
    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined();
  });

  it("rejects drafts with missing required skill structure", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        name: "",
        matchers: { hosts: [] },
        extractors: [],
      }),
    );

    expect(result.status).toBe("reject");
    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        "Skill name is required",
        "Skill matchers.hosts is required and must not be empty",
        "Skill extractors is required and must have at least one extractor",
      ]),
    );
  });

  it("returns structural errors instead of throwing for malformed skill objects", () => {
    const malformedSkill = {
      id: "broken-skill",
      name: "Broken Skill",
      description: "",
      version: "0.0.0",
      extractors: [],
    } as unknown as Skill;

    expect(() => validateSkillDefinition(malformedSkill)).not.toThrow();

    const result = validateSkillDefinition(malformedSkill);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        "Skill matchers.hosts is required and must not be empty",
        "Skill extractors is required and must have at least one extractor",
      ]),
    );
  });

  it("returns extractor structure errors instead of throwing when extractors is missing", () => {
    const malformedSkill = {
      id: "broken-skill",
      name: "Broken Skill",
      description: "Broken",
      matchers: { hosts: ["example.com"] },
      version: "0.0.0",
    } as unknown as Skill;

    expect(() => validateSkillDefinition(malformedSkill)).not.toThrow();

    const result = validateSkillDefinition(malformedSkill);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message)).toContain(
      "Skill extractors is required and must have at least one extractor",
    );
  });

  it("returns validation errors instead of throwing when persisted fields have wrong types", () => {
    const malformedSkill = {
      id: 123,
      name: 456,
      description: null,
      matchers: { hosts: ["example.com"] },
      version: "0.0.0",
      extractors: [
        {
          id: 789,
          name: {},
          description: 1,
          code: null,
          outputSchema: 2,
        },
      ],
    } as unknown as Skill;

    expect(() => validateSkillDraftDefinition(malformedSkill)).not.toThrow();

    const result = validateSkillDraftDefinition(malformedSkill);
    expect(result.status).toBe("reject");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns warning status for code with only warning-level patterns like fetch()", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "getData",
            name: "Get Data",
            description: "Fetch data from the page API",
            code: 'function () { return fetch("/api/data").then(r => r.json()); }',
            outputSchema: "object",
          },
        ],
      }),
    );

    expect(result.status).toBe("warning");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.type === "security-warning")).toBe(true);
  });

  it("returns reject with warnings populated when both errors and warnings exist", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "badCode",
            name: "Bad Code",
            description: "Code with both errors and warnings",
            code: 'function () { eval("x"); return fetch("/api"); }',
            outputSchema: "object",
          },
        ],
      }),
    );

    expect(result.status).toBe("reject");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.type === "security-warning")).toBe(true);
  });

  it("returns empty warnings for clean code", () => {
    const result = validateSkillDraftDefinition(
      createSkill({
        extractors: [
          {
            id: "getTitle",
            name: "Get Title",
            description: "Get page title from the DOM",
            code: "function () { return document.title; }",
            outputSchema: "string",
          },
        ],
      }),
    );

    expect(result.status).toBe("ok");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns validation errors instead of throwing when extractor entries are malformed", () => {
    const malformedSkill = {
      id: "broken-skill",
      name: "Broken Skill",
      description: "Broken",
      matchers: { hosts: ["example.com"] },
      version: "0.0.0",
      extractors: [null, 42],
    } as unknown as Skill;

    expect(() => validateSkillDraftDefinition(malformedSkill)).not.toThrow();

    const result = validateSkillDraftDefinition(malformedSkill);
    expect(result.status).toBe("reject");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns validation errors instead of throwing when matchers.hosts is not an array", () => {
    const malformedSkill = {
      id: "broken-skill",
      name: "Broken Skill",
      description: "Broken",
      matchers: { hosts: 123 },
      version: "0.0.0",
      extractors: [
        {
          id: "extract",
          name: "Extract",
          description: "Extract title",
          code: "return document.title;",
          outputSchema: "string",
        },
      ],
    } as unknown as Skill;

    expect(() => validateSkillDefinition(malformedSkill)).not.toThrow();

    const result = validateSkillDefinition(malformedSkill);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message)).toContain(
      "Skill matchers.hosts is required and must not be empty",
    );
  });
});
