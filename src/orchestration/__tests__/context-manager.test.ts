import { beforeEach, describe, expect, it, vi } from "vitest";
import { manageContextMessages, trimMessagesToThreshold } from "../context-manager";
import { formatRetrievedToolResult } from "@/features/tools/result-summarizer";
import type { ContextBudget } from "@/features/ai/context-budget";
import type { AIMessage } from "@/ports/ai-provider";

const budget: ContextBudget = {
  windowTokens: 32768,
  outputReserve: 4096,
  inputBudget: 28672,
  maxToolResultChars: 1000,
  compressionThreshold: 15000,
  trimThreshold: 20000,
  useToolResultStore: true,
};

describe("context-manager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces old get_tool_result full content with the stored summary form", () => {
    const messages: AIMessage[] = [
      {
        role: "tool",
        toolCallId: "tool-1",
        toolName: "get_tool_result",
        result: formatRetrievedToolResult({
          key: "tc_1",
          toolName: "read_page",
          fullValue: "FULL CONTENT",
          summary: "Body preview: hello",
        }),
      },
      { role: "assistant", content: [{ type: "text", text: "I used it." }] },
    ];

    manageContextMessages(messages, budget);

    expect((messages[0] as Extract<AIMessage, { role: "tool" }>).result).toContain(
      'Use get_tool_result("tc_1") for full content.',
    );
    expect((messages[0] as Extract<AIMessage, { role: "tool" }>).result).not.toContain(
      "FULL CONTENT",
    );
  });

  it("keeps the latest fetched full content available until a later turn exists", () => {
    const messages: AIMessage[] = [
      {
        role: "tool",
        toolCallId: "tool-1",
        toolName: "get_tool_result",
        result: formatRetrievedToolResult({
          key: "tc_1",
          toolName: "read_page",
          fullValue: "FULL CONTENT",
          summary: "Body preview: hello",
        }),
      },
    ];

    manageContextMessages(messages, budget);

    expect((messages[0] as Extract<AIMessage, { role: "tool" }>).result).toContain("FULL CONTENT");
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
