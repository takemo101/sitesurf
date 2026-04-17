import { describe, expect, it } from "vitest";
import { TOOL_RESULT_SUMMARY_MAX_CHARS, truncateForSummary } from "../truncate-utils";

describe("truncateForSummary", () => {
  it("2000 chars 以下の入力はそのまま返す", () => {
    const text = "a".repeat(TOOL_RESULT_SUMMARY_MAX_CHARS);
    expect(truncateForSummary(text)).toBe(text);
  });

  it("空文字はそのまま返す", () => {
    expect(truncateForSummary("")).toBe("");
  });

  it("2000 chars 超の入力は先頭 2000 chars + サフィックスで返す", () => {
    const text = "b".repeat(TOOL_RESULT_SUMMARY_MAX_CHARS + 1);
    const result = truncateForSummary(text);
    expect(result).toBe(
      "b".repeat(TOOL_RESULT_SUMMARY_MAX_CHARS) + "\n... (truncated for summarization)",
    );
  });

  it("サフィックスが '... (truncated for summarization)' を含む", () => {
    const text = "c".repeat(3000);
    expect(truncateForSummary(text)).toContain("(truncated for summarization)");
  });

  it("TOOL_RESULT_SUMMARY_MAX_CHARS は 2000", () => {
    expect(TOOL_RESULT_SUMMARY_MAX_CHARS).toBe(2000);
  });
});
