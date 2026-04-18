import { describe, expect, it } from "vitest";
import { toAIError, toSDKMessages, toSDKTools, toStreamEvent } from "../converters";
import type { AIMessage } from "@/ports/ai-provider";

describe("toSDKMessages", () => {
  it("converts user text message", () => {
    const messages: AIMessage[] = [{ role: "user", content: [{ type: "text", text: "hello" }] }];
    const result = toSDKMessages(messages);
    expect(result).toEqual([{ role: "user", content: [{ type: "text", text: "hello" }] }]);
  });

  it("converts user image message", () => {
    const messages: AIMessage[] = [
      {
        role: "user",
        content: [{ type: "image", mimeType: "image/png", data: "base64data" }],
      },
    ];
    const result = toSDKMessages(messages);
    expect(result).toEqual([
      {
        role: "user",
        content: [{ type: "image", image: "base64data", mediaType: "image/png" }],
      },
    ]);
  });

  it("converts assistant text message", () => {
    const messages: AIMessage[] = [{ role: "assistant", content: [{ type: "text", text: "hi" }] }];
    const result = toSDKMessages(messages);
    expect(result).toEqual([{ role: "assistant", content: [{ type: "text", text: "hi" }] }]);
  });

  it("converts assistant tool-call message", () => {
    const messages: AIMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool-call", id: "tc1", name: "read_page", args: {} }],
      },
    ];
    const result = toSDKMessages(messages);
    expect(result).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "read_page",
            input: {},
          },
        ],
      },
    ]);
  });

  it("converts tool result message", () => {
    const messages: AIMessage[] = [
      {
        role: "tool",
        toolCallId: "tc1",
        toolName: "read_page",
        result: "page content",
        isError: false,
      },
    ];
    const result = toSDKMessages(messages);
    expect(result).toEqual([
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "read_page",
            output: { type: "text", value: "page content" },
          },
        ],
      },
    ]);
  });
});

describe("toStreamEvent", () => {
  it("converts text-delta", () => {
    const event = toStreamEvent({ type: "text-delta", text: "hello" });
    expect(event).toEqual({ type: "text-delta", text: "hello" });
  });

  it("converts reasoning-delta", () => {
    const event = toStreamEvent({ type: "reasoning-delta", text: "thinking..." });
    expect(event).toEqual({ type: "reasoning-delta", text: "thinking..." });
  });

  it("converts tool-call", () => {
    const event = toStreamEvent({
      type: "tool-call",
      toolCallId: "tc1",
      toolName: "read_page",
      input: { depth: 3 },
    });
    expect(event).toEqual({
      type: "tool-call",
      id: "tc1",
      name: "read_page",
      args: { depth: 3 },
    });
  });

  it("converts finish with usage", () => {
    const event = toStreamEvent({
      type: "finish",
      finishReason: "stop",
      totalUsage: {
        promptTokens: 100,
        completionTokens: 50,
        inputTokenDetails: { cacheReadTokens: 40, cacheWriteTokens: 10 },
        outputTokenDetails: { reasoningTokens: 12 },
      },
    });
    expect(event).toEqual({
      type: "finish",
      finishReason: "stop",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cachedInputTokens: 40,
        reasoningTokens: 12,
        inputTokenDetails: { cacheReadTokens: 40, cacheWriteTokens: 10 },
        outputTokenDetails: { reasoningTokens: 12 },
      },
    });
  });

  it("converts finish without usage", () => {
    const event = toStreamEvent({
      type: "finish",
      finishReason: "tool-calls",
      totalUsage: undefined,
    });
    expect(event).toEqual({
      type: "finish",
      finishReason: "tool-calls",
      usage: undefined,
    });
  });

  it("maps end-turn to stop", () => {
    const event = toStreamEvent({
      type: "finish",
      finishReason: "end-turn",
    });
    expect(event).toEqual({
      type: "finish",
      finishReason: "other",
      usage: undefined,
    });
  });

  it("converts tool-result", () => {
    const event = toStreamEvent({
      type: "tool-result",
      toolCallId: "tc1",
      toolName: "read_page",
      output: { text: "done" },
    });
    expect(event).toEqual({
      type: "tool-result",
      id: "tc1",
      name: "read_page",
      result: { text: "done" },
    });
  });

  it("returns null for unknown event types", () => {
    expect(toStreamEvent({ type: "text-start" })).toBeNull();
    expect(toStreamEvent({ type: "start-step" })).toBeNull();
  });
});

describe("toAIError", () => {
  it("detects rate limit error", () => {
    const error = toAIError(new Error("rate limit exceeded"));
    expect(error.code).toBe("ai_rate_limit");
  });

  it("detects 429 error", () => {
    const error = toAIError({ statusCode: 429, message: "rate limited" });
    expect(error.code).toBe("ai_rate_limit");
  });

  it("detects auth error", () => {
    const error = toAIError(new Error("401 Unauthorized"));
    expect(error.code).toBe("ai_auth_invalid");
  });

  it("detects invalid api key", () => {
    const error = toAIError(new Error("Invalid API Key"));
    expect(error.code).toBe("ai_auth_invalid");
  });

  it("detects model not found", () => {
    const error = toAIError(new Error("Model not found: gpt-5"));
    expect(error.code).toBe("ai_model_not_found");
  });

  it("detects network error", () => {
    const error = toAIError(new Error("fetch failed"));
    expect(error.code).toBe("ai_network");
  });

  it("maps payload too large to a clear message", () => {
    const error = toAIError({ statusCode: 413, message: "Payload Too Large" });
    expect(error.code).toBe("ai_payload_too_large");
    expect(error.message).toContain("送信データが大きすぎます");
  });

  it("prefers status-based API errors over generic fetch wording", () => {
    const error = toAIError({ statusCode: 400, message: "fetch failed: bad request" });
    expect(error.code).toBe("ai_unknown");
    expect(error.message).toContain("AI APIエラー (400)");
  });

  it("returns unknown for other errors", () => {
    const error = toAIError(new Error("something went wrong"));
    expect(error.code).toBe("ai_unknown");
  });

  it("handles non-Error values", () => {
    const error = toAIError("string error");
    expect(error.code).toBe("ai_unknown");
    expect(error.message).toContain("string error");
  });
});

describe("toSDKTools", () => {
  const tools = [
    {
      name: "read_page",
      description: "Read page",
      parameters: {
        type: "object",
        properties: {
          maxDepth: { type: "number" },
        },
      },
    },
  ];

  it("creates tools without execute function", () => {
    const sdkTools = toSDKTools(tools);
    expect(sdkTools.read_page).toBeDefined();
    expect(sdkTools.read_page.execute).toBeUndefined();
  });
});
