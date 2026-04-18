import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContextBudget } from "../context-budget";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";

// gpt-4-32k has contextWindow = 32768
const MODEL_32K = "gpt-4-32k";
// claude-sonnet-4-6 has contextWindow = 200000
const MODEL_200K = "claude-sonnet-4-6";

describe("getContextBudget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("32k model × default maxTokens: outputReserve = DEFAULT_MAX_TOKENS", () => {
    // floor(32768 * 0.5) = 16384 === DEFAULT_MAX_TOKENS → no clamp
    const budget = getContextBudget(MODEL_32K);
    expect(budget.windowTokens).toBe(32768);
    expect(budget.outputReserve).toBe(DEFAULT_MAX_TOKENS);
    expect(budget.inputBudget).toBe(32768 - DEFAULT_MAX_TOKENS);
  });

  it("32k model × maxTokens=32000: clamp occurs, outputReserve = floor(32768*0.5)", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    // requestedOutput=32000 > floor(32768*0.5)=16384 → clamp
    const budget = getContextBudget(MODEL_32K, 32000);
    expect(budget.outputReserve).toBe(16384);
    expect(budget.inputBudget).toBe(32768 - 16384);
    expect(infoSpy).toHaveBeenCalledWith(
      "[SiteSurf:context-budget]",
      "maxTokens clamped",
      expect.objectContaining({
        requested: 32000,
        effective: 16384,
        windowTokens: 32768,
      }),
    );
  });

  it("200k model × default: maxToolResultChars = 20000", () => {
    // inputBudget = 200000 - 16384 = 183616 >= 150000
    const budget = getContextBudget(MODEL_200K);
    expect(budget.maxToolResultChars).toBe(20_000);
  });

  it("32k model: maxToolResultChars = 1000", () => {
    const budget = getContextBudget(MODEL_32K);
    // inputBudget = 16384 < 20_000 ブラケット
    expect(budget.maxToolResultChars).toBe(1_000);
  });

  it("unknown model: defaults to 128000 window", () => {
    const budget = getContextBudget("nonexistent-model-xyz");
    expect(budget.windowTokens).toBe(128_000);
  });
});
