import { beforeEach, describe, expect, it, vi } from "vitest";
import { manageContextMessages, trimMessagesToThreshold } from "../context-manager";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { AIMessage } from "@/ports/ai-provider";

const budget: ContextBudget = {
  windowTokens: 32768,
  outputReserve: 4096,
  inputBudget: 28672,
  maxToolResultChars: 1000,
  compressionThreshold: 15000,
  trimThreshold: 20000,
  systemPromptTokens: 0,
  toolsTokens: 0,
  historyTokens: 0,
  toolResultsTokens: 0,
};

describe("context-manager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("tool メッセージを maxToolResultChars で truncate する", () => {
    const longResult = "X".repeat(budget.maxToolResultChars + 500);
    const messages: AIMessage[] = [
      { role: "tool", toolCallId: "tool-1", toolName: "read_page", result: longResult },
    ];

    manageContextMessages(messages, budget);

    const result = (messages[0] as Extract<AIMessage, { role: "tool" }>).result as string;
    expect(result).toContain("... (truncated)");
    expect(result.length).toBeLessThanOrEqual(
      budget.maxToolResultChars + "\n... (truncated)".length,
    );
  });

  it("maxToolResultChars 未満の tool メッセージは改変しない", () => {
    const messages: AIMessage[] = [
      { role: "tool", toolCallId: "tool-1", toolName: "read_page", result: "small result" },
    ];

    manageContextMessages(messages, budget);

    const result = (messages[0] as Extract<AIMessage, { role: "tool" }>).result;
    expect(result).toBe("small result");
  });

  it("data:image/... を含む tool メッセージは screenshot captured プレースホルダに置換する", () => {
    const messages: AIMessage[] = [
      {
        role: "tool",
        toolCallId: "tool-1",
        toolName: "screenshot",
        result: "data:image/png;base64,AAA",
      },
    ];

    manageContextMessages(messages, budget);

    expect((messages[0] as Extract<AIMessage, { role: "tool" }>).result).toBe(
      "[screenshot captured]",
    );
  });

  it("logs when trimThreshold is reached and reports splicedMessageCount", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const messages: AIMessage[] = [
      { role: "user", content: [{ type: "text", text: "u".repeat(7000) }] },
      { role: "assistant", content: [{ type: "text", text: "a".repeat(7000) }] },
      { role: "tool", toolCallId: "tool-1", toolName: "read_page", result: "t".repeat(7000) },
      { role: "assistant", content: [{ type: "text", text: "b".repeat(7000) }] },
      { role: "assistant", content: [{ type: "text", text: "c".repeat(7000) }] },
    ];

    const trimmed = trimMessagesToThreshold(messages, 20000);

    expect(trimmed).toHaveLength(4);
    expect(infoSpy).toHaveBeenCalledWith(
      "[SiteSurf:context-manager]",
      "trimThreshold reached",
      expect.objectContaining({
        estimatedTokens: 35000,
        trimThreshold: 20000,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[SiteSurf:context-manager]",
      "splicedMessageCount",
      expect.objectContaining({
        splicedMessageCount: 1,
        remainingMessagesCount: 4,
      }),
    );
  });
});
