import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamTextParams } from "@/ports/ai-provider";

const mockStreamText = vi.fn();
const mockCreateModelFactory = vi.fn();
const mockEstimateTokens = vi.fn();

vi.mock("ai", () => ({
  streamText: mockStreamText,
  jsonSchema: (s: unknown) => s,
  tool: (t: unknown) => t,
}));

vi.mock("../provider-factory", () => ({
  createModelFactory: mockCreateModelFactory,
}));

vi.mock("@/shared/token-utils", () => ({
  estimateTokens: mockEstimateTokens,
}));

const { VercelAIAdapter } = await import("../vercel-ai-adapter");

function makeParams(overrides: Partial<StreamTextParams> = {}): StreamTextParams {
  return {
    model: "gpt-4",
    systemPrompt: "You are a test assistant.",
    messages: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    tools: [],
    ...overrides,
  };
}

function makeAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next() {
          if (i < items.length) return Promise.resolve({ value: items[i++], done: false as const });
          return Promise.resolve({ value: undefined as unknown as T, done: true as const });
        },
      };
    },
  };
}

describe("VercelAIAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs estimated prompt tokens before streaming", async () => {
    const mockModel = {};
    const mockFactory = vi.fn().mockReturnValue(mockModel);
    mockCreateModelFactory.mockReturnValue(mockFactory);
    mockEstimateTokens.mockReturnValue(512);

    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    mockStreamText.mockReturnValue({
      fullStream: makeAsyncIterable([]),
    });

    const adapter = new VercelAIAdapter({ provider: "openai", model: "gpt-4" });
    const params = makeParams();

    const events = [];
    for await (const event of adapter.streamText(params)) {
      events.push(event);
    }

    expect(mockEstimateTokens).toHaveBeenCalledWith(params.messages);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("vercel-ai-adapter"),
      expect.stringContaining("streamText tokens"),
      expect.objectContaining({ estimatedPromptTokens: 512 }),
    );

    logSpy.mockRestore();
  });

  it("uses system prompt for chat-completions API mode", async () => {
    const mockModel = {};
    const mockFactory = vi.fn().mockReturnValue(mockModel);
    mockCreateModelFactory.mockReturnValue(mockFactory);
    mockEstimateTokens.mockReturnValue(100);

    mockStreamText.mockReturnValue({
      fullStream: makeAsyncIterable([]),
    });

    const adapter = new VercelAIAdapter({
      provider: "openai",
      model: "gpt-4",
      apiMode: "chat-completions",
    });
    const params = makeParams({ systemPrompt: "Test system prompt" });

    for await (const _ of adapter.streamText(params)) {
      /* consume */
    }

    const callArgs = mockStreamText.mock.calls[0][0];
    expect(callArgs.system).toBe("Test system prompt");
  });

  it("uses instructions for responses API mode", async () => {
    const mockModel = {};
    const mockFactory = vi.fn().mockReturnValue(mockModel);
    mockCreateModelFactory.mockReturnValue(mockFactory);
    mockEstimateTokens.mockReturnValue(100);

    mockStreamText.mockReturnValue({
      fullStream: makeAsyncIterable([]),
    });

    const adapter = new VercelAIAdapter({
      provider: "openai",
      model: "gpt-4",
      apiMode: "responses",
    });
    const params = makeParams({ systemPrompt: "Response API instructions" });

    for await (const _ of adapter.streamText(params)) {
      /* consume */
    }

    const callArgs = mockStreamText.mock.calls[0][0];
    expect(callArgs.system).toBeUndefined();
    expect(callArgs.providerOptions?.openai?.instructions).toBe("Response API instructions");
  });

  it("yields error event when streaming fails", async () => {
    const mockModel = {};
    const mockFactory = vi.fn().mockReturnValue(mockModel);
    mockCreateModelFactory.mockReturnValue(mockFactory);
    mockEstimateTokens.mockReturnValue(0);

    const testError = new Error("stream failure");
    mockStreamText.mockReturnValue({
      fullStream: {
        [Symbol.asyncIterator]() {
          return {
            next() {
              return Promise.reject(testError);
            },
          };
        },
      },
    });

    vi.spyOn(console, "error").mockImplementation(() => {});

    const adapter = new VercelAIAdapter({ provider: "openai", model: "gpt-4" });
    const events = [];
    for await (const event of adapter.streamText(makeParams())) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");

    vi.restoreAllMocks();
  });
});
