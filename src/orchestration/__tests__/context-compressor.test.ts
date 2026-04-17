import { describe, expect, it } from "vitest";
import {
  compressIfNeeded,
  buildMessagesForAPI,
  estimateTokens,
  COMPRESS_THRESHOLDS,
} from "../context-compressor";
import type { AIProvider, AIMessage, StreamEvent } from "@/ports/ai-provider";
import type { Session } from "@/ports/session-types";
import type { ProviderId } from "@/shared/constants";

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

describe("COMPRESS_THRESHOLDS", () => {
  it("全プロバイダーの閾値が定義されている", () => {
    const providerIds: ProviderId[] = [
      "anthropic",
      "openai",
      "google",
      "copilot",
      "kimi",
      "kimi-coding",
      "zai",
      "zai-coding",
      "local",
    ];
    for (const id of providerIds) {
      expect(COMPRESS_THRESHOLDS[id]).toBeGreaterThan(0);
    }
  });

  it("ローカルLLMの閾値が最も低い", () => {
    expect(COMPRESS_THRESHOLDS.local).toBeLessThan(COMPRESS_THRESHOLDS.anthropic);
    expect(COMPRESS_THRESHOLDS.local).toBeLessThan(COMPRESS_THRESHOLDS.openai);
    expect(COMPRESS_THRESHOLDS.local).toBeLessThan(COMPRESS_THRESHOLDS.google);
    expect(COMPRESS_THRESHOLDS.local).toBeLessThan(COMPRESS_THRESHOLDS.copilot);
  });
});

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

describe("buildMessagesForAPI", () => {
  it("summary なしの場合 history をそのまま返す", () => {
    const history: AIMessage[] = [createUserMessage("hello"), createAssistantMessage("hi")];
    const session = createSession({ history });
    const result = buildMessagesForAPI(session);
    expect(result).toEqual(history);
  });

  it("summary ありの場合 user/assistant ペアを先頭に挿入する", () => {
    const history: AIMessage[] = [createUserMessage("次の質問")];
    const session = createSession({
      history,
      summary: { text: "以前の会話の内容", compressedAt: Date.now(), originalMessageCount: 20 },
    });
    const result = buildMessagesForAPI(session);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "[以前の会話の要約]\n以前の会話の内容" }],
    });
    expect(result[1]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "理解しました。要約の内容を踏まえて引き続きお手伝いします。" },
      ],
    });
    expect(result[2]).toEqual(createUserMessage("次の質問"));
  });

  it("summary ありでも history の順序を維持する", () => {
    const history: AIMessage[] = [
      createUserMessage("Q1"),
      createAssistantMessage("A1"),
      createUserMessage("Q2"),
    ];
    const session = createSession({
      history,
      summary: { text: "要約", compressedAt: Date.now(), originalMessageCount: 10 },
    });
    const result = buildMessagesForAPI(session);

    expect(result).toHaveLength(5);
    expect(result[2]).toEqual(createUserMessage("Q1"));
    expect(result[3]).toEqual(createAssistantMessage("A1"));
    expect(result[4]).toEqual(createUserMessage("Q2"));
  });
});

describe("compressIfNeeded", () => {
  it("閾値未満の場合は圧縮しない", async () => {
    const provider = createMockAIProvider("summary");
    const session = createSession({ history: [createUserMessage("short")] });
    const result = await compressIfNeeded(provider, session, "test-model", "anthropic");

    expect(result.compressed).toBe(false);
    expect(result.session).toBe(session);
  });

  it("クラウドプロバイダーで userConfirmed なしの場合は圧縮しない", async () => {
    const provider = createMockAIProvider("summary");
    const longText = "x".repeat(200_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });

    const result = await compressIfNeeded(provider, session, "test-model", "anthropic");
    expect(result.compressed).toBe(false);
  });

  it("クラウドプロバイダーで userConfirmed: true の場合は圧縮する", async () => {
    const provider = createMockAIProvider("要約結果");
    const longText = "x".repeat(200_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });

    const result = await compressIfNeeded(provider, session, "test-model", "anthropic", {
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

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
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

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
    expect(result.compressed).toBe(true);
    expect(result.session.history).toHaveLength(10);
  });

  it("圧縮対象が空の場合はスキップする", async () => {
    const provider = createMockAIProvider("要約");
    const longText = "x".repeat(1_000);
    const history: AIMessage[] = Array.from({ length: 10 }, () => createUserMessage(longText));
    const session = createSession({ history });

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
    expect(result.compressed).toBe(false);
  });

  it("要約生成失敗時は元のセッションを返す", async () => {
    const provider = createFailingAIProvider();
    const longText = "x".repeat(10_000);
    const history: AIMessage[] = Array.from({ length: 15 }, () => createUserMessage(longText));
    const session = createSession({ history });

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
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

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
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

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
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

    const result = await compressIfNeeded(provider, session, "llama3.2", "local");
    expect(result.session.messages).toBe(messages);
  });
});
