import { describe, expect, it } from "vitest";
import {
  compressIfNeeded,
  compressMessagesIfNeeded,
  estimateTokens,
  splitByKeepRecentTokens,
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
    systemPromptTokens: 0,
    toolsTokens: 0,
    historyTokens: 0,
    toolResultsTokens: 0,
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
    // KEEP_RECENT_TOKENS=20_000 に対し各メッセージが 200k 相当 → 末尾1件のみ保持。
    expect(result.session.history).toHaveLength(1);
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

  it("末尾 KEEP_RECENT_TOKENS 分のメッセージを保持する", async () => {
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
    // 末尾 5 件の短メッセージ + 10k 相当の long メッセージ 2 件で 20k token を満たす。
    expect(result.session.history).toHaveLength(7);
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
    // 各メッセージ 10k 相当 × 15 件 → 末尾 2 件を保持、13 件を要約対象に追加する。
    expect(result.session.summary?.originalMessageCount).toBe(43);
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

describe("splitByKeepRecentTokens", () => {
  it("空配列で toCompress/toKeep ともに空を返す", () => {
    const result = splitByKeepRecentTokens([], 100);
    expect(result.toCompress).toEqual([]);
    expect(result.toKeep).toEqual([]);
  });

  it("全てが keepTokens 未満の場合は全てを toKeep として保持する", () => {
    const messages: AIMessage[] = [createUserMessage("a"), createUserMessage("b")];
    const result = splitByKeepRecentTokens(messages, 100);
    expect(result.toCompress).toEqual([]);
    expect(result.toKeep).toEqual(messages);
  });

  it("cut point が tool メッセージに当たった場合は直前の assistant(tool-call) まで後退する", () => {
    const assistantWithCall: AIMessage = {
      role: "assistant",
      content: [
        { type: "text", text: "calling" },
        { type: "tool-call", id: "tc1", name: "read_page", args: {} },
      ],
    };
    const toolResult: AIMessage = {
      role: "tool",
      toolCallId: "tc1",
      toolName: "read_page",
      result: "x".repeat(50),
    };
    const tailUser = createUserMessage("y".repeat(60));
    const messages: AIMessage[] = [
      createUserMessage("u".repeat(200)),
      assistantWithCall,
      toolResult,
      tailUser,
    ];
    // tailUser だけでは 100 に届かず、tool を取り込むとそこが cut point になるが、
    // tool 直前の assistant(tool-call) まで後退して一緒に保持されなければならない。
    const result = splitByKeepRecentTokens(messages, 100);
    expect(result.toCompress).toEqual([messages[0]]);
    expect(result.toKeep).toEqual([assistantWithCall, toolResult, tailUser]);
  });

  it("並列 tool 実行 (assistant 1 つに対し tool 複数) の pair も分断しない", () => {
    const assistantWithTwoCalls: AIMessage = {
      role: "assistant",
      content: [
        { type: "tool-call", id: "tc1", name: "navigate", args: {} },
        { type: "tool-call", id: "tc2", name: "read_page", args: {} },
      ],
    };
    const toolA: AIMessage = {
      role: "tool",
      toolCallId: "tc1",
      toolName: "navigate",
      result: "a".repeat(30),
    };
    const toolB: AIMessage = {
      role: "tool",
      toolCallId: "tc2",
      toolName: "read_page",
      result: "b".repeat(30),
    };
    const messages: AIMessage[] = [
      createUserMessage("u".repeat(200)),
      assistantWithTwoCalls,
      toolA,
      toolB,
    ];
    const result = splitByKeepRecentTokens(messages, 50);
    expect(result.toKeep[0]).toBe(assistantWithTwoCalls);
    expect(result.toKeep).toHaveLength(3);
  });

  it("画像を含むメッセージは 6000 chars 相当としてトークン計算される", () => {
    const messageWithImage: AIMessage = {
      role: "user",
      content: [
        { type: "text", text: "hi" },
        { type: "image", mimeType: "image/png", data: "base64..." },
      ],
    };
    const messages: AIMessage[] = [
      createUserMessage("u".repeat(1_000)),
      createUserMessage("v".repeat(1_000)),
      messageWithImage,
    ];
    const result = splitByKeepRecentTokens(messages, 5_000);
    // 画像 1 枚で ~6000 相当 → tail 1 件で keepTokens を満たす。
    expect(result.toKeep).toEqual([messageWithImage]);
    expect(result.toCompress).toHaveLength(2);
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
    // 各メッセージ 10k token 相当 × 15 → 末尾 2 件を保持、先頭に要約メッセージで計 3 件。
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n## Goal\n要約された目標` },
      ],
    });
  });

  it("既存の構造化要約メッセージをローリング入力として更新する", async () => {
    const provider = createMockAIProvider("## Goal\n更新後の要約");
    const longText = "x".repeat(10_000);
    const messages: AIMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n## Goal\n前回の要約` },
        ],
      },
      ...Array.from({ length: 15 }, (_, i) => createUserMessage(`${i}-${longText}`)),
    ];
    const budget = createBudget({ trimThreshold: 100 });

    const result = await compressMessagesIfNeeded(provider, messages, budget, "llama3.2", "local");

    expect(result.compressed).toBe(true);
    expect(result.messages[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: `${STRUCTURED_SUMMARY_MESSAGE_PREFIX}\n## Goal\n更新後の要約` },
      ],
    });
  });
});
