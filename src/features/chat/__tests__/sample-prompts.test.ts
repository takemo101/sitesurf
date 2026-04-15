import { describe, expect, it } from "vitest";
import { SAMPLE_PROMPTS } from "../sample-prompts";

describe("SAMPLE_PROMPTS", () => {
  it("4つのプロンプトが定義されている", () => {
    expect(SAMPLE_PROMPTS).toHaveLength(4);
  });

  it.each(SAMPLE_PROMPTS.map((p, i) => [i, p] as const))(
    "プロンプト[%i] に label と prompt がある",
    (_index, prompt) => {
      expect(typeof prompt.label).toBe("string");
      expect(prompt.label.length).toBeGreaterThan(0);
      expect(typeof prompt.prompt).toBe("string");
      expect(prompt.prompt.length).toBeGreaterThan(0);
    },
  );

  it("label はすべてユニーク", () => {
    const labels = SAMPLE_PROMPTS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("prompt はすべてユニーク", () => {
    const prompts = SAMPLE_PROMPTS.map((p) => p.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});
