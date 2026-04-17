import { describe, expect, it } from "vitest";
import { estimateTokens } from "../token-utils";
import type { AIMessage } from "@/ports/ai-provider";

describe("estimateTokens", () => {
  it("空の配列は 0 を返す", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("tool メッセージのみの場合 result の長さを返す", () => {
    const messages: AIMessage[] = [
      { role: "tool", toolCallId: "1", toolName: "fn", result: "hello" },
    ];
    expect(estimateTokens(messages)).toBe(5);
  });

  it("image を含む user メッセージは text + 6000 を返す", () => {
    const messages: AIMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "abc" },
          { type: "image", mimeType: "image/png", data: "base64data" },
        ],
      },
    ];
    expect(estimateTokens(messages)).toBe(3 + 6000);
  });

  it("tool-call を含む assistant メッセージは text + JSON.stringify(args).length を返す", () => {
    const args = { key: "value" };
    const messages: AIMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "thinking" },
          { type: "tool-call", id: "c1", name: "fn", args },
        ],
      },
    ];
    expect(estimateTokens(messages)).toBe("thinking".length + JSON.stringify(args).length);
  });

  it("user/assistant/tool が混在したメッセージ配列を合算する", () => {
    const args = { x: 1 };
    const messages: AIMessage[] = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
      {
        role: "assistant",
        content: [{ type: "tool-call", id: "c1", name: "fn", args }],
      },
      { role: "tool", toolCallId: "c1", toolName: "fn", result: "done" },
    ];
    expect(estimateTokens(messages)).toBe(2 + JSON.stringify(args).length + 4);
  });
});
