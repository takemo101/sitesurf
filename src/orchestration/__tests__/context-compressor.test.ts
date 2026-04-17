import { describe, expect, it } from "vitest";
import {
  compressIfNeeded,
  compressMessagesIfNeeded,
  estimateTokens,
  STRUCTURED_SUMMARY_MESSAGE_PREFIX,
} from "../context-compressor";
import type { AIProvider, AIMessage, StreamEvent } from "@/ports/ai-provider";
import type { Session } from "@/ports/session-types";
import type { ContextBudget } from "@/features/ai/context-budget";

function createMockAIProvider(summaryText: string): AIProvider {
  return {
    async *streamText() {
      yield { type: "text-delta", text: summaryText } satisfies StreamEvent;
      yield { type: "finish", finishReason: "stop" } satisfies StreamEvent;
    },
  };
}

function createFailingAIProvider(): AIProvider {
  return {
    async *streamText() {
      yield {
        type: "error",
        error: { code: "ai_network", message: "connection failed" },
      } satisfies StreamEvent;
    },
  };
}

function createUserMessage(text: string): AIMessage {
  return { role: "user", content: [{ type: "text", text }] };
}

function createAssistantMessage(text: string): AIMessage {
  return { role: "assistant", content: [{ type: "text", text }] };
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "test-session",
    title: "テスト",
    createdAt: new Date().toISOString(),
    model: "test-model",
    messages: [],
    history: [],
    ...overrides,
  };
}

function createBudget(overrides: Partial<ContextBudget> = {}): ContextBudget {
  return {
    windowTokens: 32_768,
    outputReserve: 16_384,
    inputBudget: 16_384,
    maxToolResultChars: 1_000,
    compressionThreshold: 9_830,
    trimThreshold: 13_926,
    useToolResultStore: true,
    ...overrides,
  };
}

describe("estimateTokens", () => {
  it("空メッセージ配列で 0 を返す", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("user メッセージのテキスト文字数を合計する", () => {
    const messages: AIMessage[] = [createUserMessage("hello"), createUserMessage("world")];
    expect(estimateTokens(messages)).toBe(10);
  });

  it("assistant メッセージのテキスト文字数を合計する", () => {
    const messages: AIMessage[] = [createAssistantMessage("こんにちは")];
    expect(estimateTokens(messages)).toBe(5);
  });

  it("tool メッセージは result の文字数をカウントする", () => {
    const messages: AIMessage[] = [
      { role: "tool", toolCallId: "tc1", toolName: "read_page", result: "page content" },
    ];
    expect(estimateTokens(messages)).toBe("page content".length);
  });

  it("image content は 6000 chars 相当としてカウントする", () => {
    const messages: AIMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "look" },
          { type: "image", mimeType: "image/png", data: "base64longstring" },
        ],
      },
    ];
    expect(estimateTokens(messages)).toBe(4 + 6000);
  });

  it("tool-call content は args の文字数をカウントする", () => {
    const messages: AIMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "calling" },
          { type: "tool-call", id: "tc1", name: "read_page", args: {} },
        ],
      },
    ];
    expect(estimateTokens(messages)).toBe(7 + JSON.stringify({}).length);
  });
});

describe("compressIfNeeded", () => {
  it("budget.trimThreshold 未満の場合は圧縮しない", async () => {
    const provider = createMockAIProvider("summary");
    const session = createSession({ history: [createUserMessage("short")] });
    const budget = createBudget({ trimThreshold: 100 });
    const result = await compressIfNeeded(provider, session, budget, "test-model", "anthropic");

    expect(result.compressed).toBe(false);
    expect(result.session).toBe(session);
  });

  it("クラウドプロバイダーで userConfirmed なしの場合は圧縮しない", async () => {
    const provider = createMockAIProvider("summary");
    const longText = "x".repeat(200_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "test-model", "anthropic");
    expect(result.compressed).toBe(false);
  });

  it("クラウドプロバイダーで userConfirmed: true の場合は圧縮する", async () => {
    const provider = createMockAIProvider("要約結果");
    const longText = "x".repeat(200_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "test-model", "anthropic", {
      userConfirmed: true,
    });
    expect(result.compressed).toBe(true);
    expect(result.session.summary?.text).toBe("要約結果");
    expect(result.session.history).toHaveLength(10);
  });

  it("ローカルLLMでは自動圧縮する", async () => {
    const provider = createMockAIProvider("ローカル要約");
    const longText = "x".repeat(10_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    expect(result.compressed).toBe(true);
    expect(result.session.summary?.text).toBe("ローカル要約");
  });

  it("直近10件のメッセージを保持する", async () => {
    const provider = createMockAIProvider("要約");
    const history: AIMessage[] = Array.from({ length: 20 }, (_, i) =>
      createUserMessage(`msg-${i}`),
    );
    const longText = "x".repeat(10_000);
    const longHistory: AIMessage[] = [
      ...Array.from({ length: 15 }, () => createUserMessage(longText)),
      ...history.slice(-5),
    ];
    const session = createSession({ history: longHistory });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    expect(result.compressed).toBe(true);
    expect(result.session.history).toHaveLength(10);
  });

  it("圧縮対象が空の場合はスキップする", async () => {
    const provider = createMockAIProvider("要約");
    const longText = "x".repeat(1_000);
    const history: AIMessage[] = Array.from({ length: 10 }, () => createUserMessage(longText));
    const session = createSession({ history });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    expect(result.compressed).toBe(false);
  });

  it("要約生成失敗時は元のセッションを返す", async () => {
    const provider = createFailingAIProvider();
    const longText = "x".repeat(10_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    expect(result.compressed).toBe(false);
    expect(result.session).toBe(session);
  });

  it("既存の summary がある場合 originalMessageCount を加算する", async () => {
    const provider = createMockAIProvider("再要約結果");
    const longText = "x".repeat(10_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({
      history,
      summary: { text: "前回の要約", compressedAt: Date.now() - 60_000, originalMessageCount: 30 },
    });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    expect(result.compressed).toBe(true);
    expect(result.session.summary?.originalMessageCount).toBe(35);
    expect(result.session.summary?.text).toBe("再要約結果");
  });

  it("圧縮後の compressedAt が現在時刻付近である", async () => {
    const provider = createMockAIProvider("要約");
    const longText = "x".repeat(10_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });
    const before = Date.now();
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    const after = Date.now();

    expect(result.session.summary?.compressedAt).toBeGreaterThanOrEqual(before);
    expect(result.session.summary?.compressedAt).toBeLessThanOrEqual(after);
  });

  it("元のセッションの messages (UI用) は変更されない", async () => {
    const provider = createMockAIProvider("要約");
    const longText = "x".repeat(10_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const messages = [{ id: "1", role: "user" as const, content: "hello", timestamp: Date.now() }];
    const session = createSession({ history, messages });
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressIfNeeded(provider, session, budget, "llama3.2", "local");
    expect(result.session.messages).toBe(messages);
  });
});

describe("compressMessagesIfNeeded", () => {
  it("圧縮時は先頭に構造化要約メッセージを追加して最近のメッセージを残す", async () => {
    const provider = createMockAIProvider("## Goal\n要約された目標");
    const longText = "x".repeat(10_000);
    const messages: AIMessage[] = Array.from({ length: 15 }, (_, i) =>
      createUserMessage(`${i}-${longText}`),
    );
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressMessagesIfNeeded(provider, messages, budget, "llama3.2", "local");

    expect(result.compressed).toBe(true);
    expect(result.summary?.text).toBe("## Goal\n要約された目標");
    expect(result.messages).toHaveLength(11);
    expect(result.messages[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n## Goal\n要約された目標` }],
    });
  });

  it("既存の構造化要約メッセージをローリング入力として更新する", async () => {
    const provider = createMockAIProvider("## Goal\n更新後の要約");
    const longText = "x".repeat(10_000);
    const messages: AIMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n## Goal\n前回の要約` }],
      },
      ...Array.from({ length: 15 }, (_, i) => createUserMessage(`${i}-${longText}`)),
    ];
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressMessagesIfNeeded(provider, messages, budget, "llama3.2", "local");

    expect(result.compressed).toBe(true);
    expect(result.messages[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n## Goal\n更新後の要約` }],
    });
  });
});
