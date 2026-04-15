import { describe, expect, it } from "vitest";

import type { Session, ChatMessage } from "@/ports/session-types";
import type { AIMessage } from "@/ports/ai-provider";

import { buildSaveData } from "../save-builder";

function makeSnapshot(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    title: "テスト",
    createdAt: "2025-01-01T00:00:00.000Z",
    model: "claude-sonnet-4-20250514",
    messages: [],
    history: [],
    ...overrides,
  };
}

function makeUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content,
    timestamp: Date.now(),
  };
}

function makeAssistantMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    timestamp: Date.now(),
  };
}

describe("buildSaveData", () => {
  it("Session と SessionMeta を構築する", () => {
    const snapshot = makeSnapshot();
    const messages = [makeUserMessage("hello"), makeAssistantMessage("hi")];
    const history: AIMessage[] = [{ role: "user", content: [{ type: "text", text: "hello" }] }];

    const { session, meta } = buildSaveData(snapshot, { messages, history });

    expect(session.id).toBe("sess-1");
    expect(session.messages).toBe(messages);
    expect(session.history).toBe(history);
    expect(session.title).toBe("テスト");
    expect(session.model).toBe("claude-sonnet-4-20250514");

    expect(meta.id).toBe("sess-1");
    expect(meta.title).toBe("テスト");
    expect(meta.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(meta.lastModified).toBeTruthy();
    expect(meta.messageCount).toBe(2);
    expect(meta.modelId).toBe("claude-sonnet-4-20250514");
  });

  it("preview にユーザーとアシスタントの content を結合する", () => {
    const snapshot = makeSnapshot();
    const messages = [
      makeUserMessage("質問です"),
      makeAssistantMessage("回答です"),
      { id: "3", role: "system" as const, content: "システム", timestamp: 0 },
    ];

    const { meta } = buildSaveData(snapshot, { messages, history: [] });

    expect(meta.preview).toBe("質問です\n回答です\n");
  });

  it("preview は 2048 文字で切り捨てる", () => {
    const snapshot = makeSnapshot();
    const longContent = "あ".repeat(3000);
    const messages = [makeUserMessage(longContent)];

    const { meta } = buildSaveData(snapshot, { messages, history: [] });

    expect(meta.preview.length).toBe(2048);
  });

  it("メッセージが空の場合は preview が空文字", () => {
    const snapshot = makeSnapshot();

    const { meta } = buildSaveData(snapshot, { messages: [], history: [] });

    expect(meta.preview).toBe("");
    expect(meta.messageCount).toBe(0);
  });

  it("snapshot の summary を session に保持する", () => {
    const snapshot = makeSnapshot({
      summary: {
        text: "要約テキスト",
        compressedAt: 1000,
        originalMessageCount: 20,
      },
    });

    const { session } = buildSaveData(snapshot, { messages: [], history: [] });

    expect(session.summary).toEqual({
      text: "要約テキスト",
      compressedAt: 1000,
      originalMessageCount: 20,
    });
  });
});
