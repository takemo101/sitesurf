import { describe, expect, it } from "vitest";

import type { AIMessage } from "@/ports/ai-provider";

import {
  buildStructuredSummaryPromptInput,
  STRUCTURED_SUMMARY_SYSTEM_PROMPT,
} from "../structured-summary-prompt";

describe("structured-summary-prompt", () => {
  it("既存要約と会話履歴を構造化してプロンプトに含める", () => {
    const messages: AIMessage[] = [
      { role: "user", content: [{ type: "text", text: "調査を続けて" }] },
      { role: "assistant", content: [{ type: "text", text: "了解です" }] },
      {
        role: "tool",
        toolCallId: "tc-1",
        toolName: "read_page",
        result: "x".repeat(2500),
      },
    ];

    const prompt = buildStructuredSummaryPromptInput({
      existingSummary: "## Goal\n以前の要約",
      messages,
    });

    expect(STRUCTURED_SUMMARY_SYSTEM_PROMPT).toContain("空のセクションは出力しない");
    expect(prompt).toContain("[既存の構造化要約]");
    expect(prompt).toContain("## Goal\n以前の要約");
    expect(prompt).toContain("[新規の会話履歴]");
    expect(prompt).toContain("ユーザー: 調査を続けて");
    expect(prompt).toContain("アシスタント: 了解です");
    expect(prompt).toContain("ツール (read_page):");
    expect(prompt).toContain("...(truncated for summary)");
  });
});
