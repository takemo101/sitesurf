import type { StateCreator } from "zustand";
import type { AIMessage, TokenUsage } from "@/ports/ai-provider";
import type { ChatMessage, ToolCallInfo } from "@/ports/session-types";
import type { AppError, Result } from "@/shared/errors";
import type { AppStore } from "@/store/types";

export interface ChatSlice {
  messages: ChatMessage[];
  history: AIMessage[];
  isStreaming: boolean;
  abortController: AbortController | null;
  shownSkillIds: ReadonlySet<string>;

  addUserMessage(content: string, image?: string): void;
  addMessage(msg: Omit<ChatMessage, "id" | "timestamp">): void;
  startNewAssistantMessage(): void;
  appendDelta(text: string): void;
  appendReasoning(text: string): void;
  updateLastAssistant(content: string): void;
  clearLastAssistantMessage(): void;
  setLastMessageUsage(usage: TokenUsage): void;
  addToolCall(tc: ToolCallInfo): void;
  addToolCallToLast(tc: ToolCallInfo): void;
  appendToolInputDelta(id: string, delta: string): void;
  updateToolCallArgs(id: string, args: Record<string, unknown>): void;
  updateToolCallResult(
    toolIdOrMsgId: string,
    resultOrToolId: Result<unknown, AppError> | string,
    resultStr?: string,
    success?: boolean,
  ): void;
  addSystemMessage(text: string): void;
  addNavigationMessage(nav: { url: string; title: string; favicon?: string }): void;
  addErrorMessage(error: AppError): void;
  syncHistory(messages: AIMessage[]): void;
  pushHistory(msg: AIMessage): void;
  setStreaming(v: boolean): void;
  getAbortSignal(): AbortSignal | undefined;
  clearMessages(): void;
  clearHistory(): void;
  clearAll(): void;
  addShownSkillIds(ids: string[]): void;
  resetShownSkillIds(): void;
}

// Invariant: mutating actions must only replace the reference of the message(s)
// they actually change. Non-target messages must keep the same object reference
// so React.memo on MessageBubble / MarkdownContent can skip re-renders during
// streaming. `s.messages.map(m => ({ ...m }))` is forbidden.
function findLastAssistantIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

export const createChatSlice: StateCreator<AppStore, [], [], ChatSlice> = (set, get) => ({
  messages: [],
  history: [],
  isStreaming: false,
  abortController: null,
  shownSkillIds: new Set<string>(),

  addUserMessage: (content, image) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          timestamp: Date.now(),
          image,
        },
      ],
    })),

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, { ...msg, id: crypto.randomUUID(), timestamp: Date.now() }],
    })),

  startNewAssistantMessage: () =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          toolCalls: [],
        },
      ],
    })),

  appendDelta: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = { ...msgs[idx], content: msgs[idx].content + text };
      }
      return { messages: msgs };
    }),

  appendReasoning: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = { ...msgs[idx], reasoning: (msgs[idx].reasoning ?? "") + text };
      }
      return { messages: msgs };
    }),

  updateLastAssistant: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = { ...msgs[idx], content };
      }
      return { messages: msgs };
    }),

  clearLastAssistantMessage: () =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = { ...msgs[idx], content: "", toolCalls: [] };
      }
      return { messages: msgs };
    }),

  setLastMessageUsage: (usage) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = { ...msgs[idx], usage };
      }
      return { messages: msgs };
    }),

  addToolCall: (tc) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = {
          ...msgs[idx],
          toolCalls: [...(msgs[idx].toolCalls ?? []), tc],
        };
      }
      return { messages: msgs };
    }),

  addToolCallToLast: (tc) =>
    set((s) => {
      const msgs = [...s.messages];
      const idx = findLastAssistantIndex(msgs);
      if (idx >= 0) {
        msgs[idx] = {
          ...msgs[idx],
          toolCalls: [...(msgs[idx].toolCalls ?? []), tc],
        };
      }
      return { messages: msgs };
    }),

  appendToolInputDelta: (id, delta) =>
    set((s) => {
      const idx = findLastAssistantIndex(s.messages);
      if (idx < 0) return s;
      const target = s.messages[idx];
      if (!target.toolCalls) return s;
      const nextToolCalls = target.toolCalls.map((tc) =>
        tc.id === id ? { ...tc, inputDelta: (tc.inputDelta ?? "") + delta } : tc,
      );
      if (nextToolCalls === target.toolCalls) return s;
      const msgs = [...s.messages];
      msgs[idx] = { ...target, toolCalls: nextToolCalls };
      return { messages: msgs };
    }),

  updateToolCallArgs: (id, args) =>
    set((s) => {
      const idx = findLastAssistantIndex(s.messages);
      if (idx < 0) return s;
      const target = s.messages[idx];
      if (!target.toolCalls) return s;
      const nextToolCalls = target.toolCalls.map((tc) => (tc.id === id ? { ...tc, args } : tc));
      if (nextToolCalls === target.toolCalls) return s;
      const msgs = [...s.messages];
      msgs[idx] = { ...target, toolCalls: nextToolCalls };
      return { messages: msgs };
    }),

  updateToolCallResult: (
    toolIdOrMsgId: string,
    resultOrToolId: Result<unknown, AppError> | string,
    resultStr?: string,
    success?: boolean,
  ) => {
    if (typeof resultOrToolId === "string") {
      const msgId = toolIdOrMsgId;
      const toolId = resultOrToolId;
      set((s) => {
        const idx = s.messages.findIndex((m) => m.id === msgId);
        if (idx < 0) return s;
        const target = s.messages[idx];
        if (!target.toolCalls) return s;
        const nextToolCalls = target.toolCalls.map((tc) =>
          tc.id === toolId
            ? { ...tc, result: resultStr, success, isRunning: false, inputDelta: undefined }
            : tc,
        );
        const msgs = [...s.messages];
        msgs[idx] = { ...target, toolCalls: nextToolCalls };
        return { messages: msgs };
      });
    } else {
      const toolId = toolIdOrMsgId;
      const result = resultOrToolId;
      set((s) => {
        const idx = findLastAssistantIndex(s.messages);
        if (idx < 0) return s;
        const target = s.messages[idx];
        if (!target.toolCalls) return s;
        const nextToolCalls = target.toolCalls.map((tc) =>
          tc.id === toolId
            ? {
                ...tc,
                result: result.ok ? JSON.stringify(result.value) : result.error.message,
                success: result.ok,
                isRunning: false,
                inputDelta: undefined,
              }
            : tc,
        );
        const msgs = [...s.messages];
        msgs[idx] = { ...target, toolCalls: nextToolCalls };
        return { messages: msgs };
      });
    }
  },

  addSystemMessage: (text) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: text,
          timestamp: Date.now(),
        },
      ],
    })),

  addNavigationMessage: (nav) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "navigation",
          content: nav.title,
          url: nav.url,
          favicon: nav.favicon,
          timestamp: Date.now(),
        },
      ],
    })),

  addErrorMessage: (error) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: crypto.randomUUID(),
          role: "error",
          content: error.message,
          errorCode: error.code,
          timestamp: Date.now(),
        },
      ],
    })),

  syncHistory: (messages) =>
    set((s) => ({
      history: messages,
      activeSessionSnapshot: s.activeSessionSnapshot
        ? { ...s.activeSessionSnapshot, history: messages, messages: s.messages }
        : null,
    })),

  pushHistory: (msg) => set((s) => ({ history: [...s.history, msg] })),

  setStreaming: (v) =>
    set({
      isStreaming: v,
      abortController: v ? new AbortController() : null,
    }),

  getAbortSignal: () => get().abortController?.signal,

  clearMessages: () => set({ messages: [] }),

  clearHistory: () => set({ history: [] }),

  clearAll: () => set({ messages: [], history: [], shownSkillIds: new Set<string>() }),

  addShownSkillIds: (ids) =>
    set((s) => {
      const next = new Set<string>(s.shownSkillIds);
      for (const id of ids) next.add(id);
      return { shownSkillIds: next };
    }),

  resetShownSkillIds: () => set({ shownSkillIds: new Set<string>() }),
});
