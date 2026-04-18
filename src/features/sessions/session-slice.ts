import type { StateCreator } from "zustand";
import type { ChatMessage, Session, SessionMeta } from "@/ports/session-types";
import type { AppStore } from "@/store/types";

/** IndexedDB から復元したメッセージの toolCalls.args が文字列のまま残っているケースを修復 */
function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  let dirty = false;
  const result = messages.map((msg) => {
    if (!msg.toolCalls) return msg;
    const sanitized = msg.toolCalls.map((tc) => {
      if (tc.args && typeof tc.args === "object") return tc;
      dirty = true;
      let parsed: Record<string, unknown> = {};
      if (typeof tc.args === "string") {
        try {
          const obj = JSON.parse(tc.args);
          if (obj && typeof obj === "object") parsed = obj;
        } catch {
          // パース不能な断片はそのまま空オブジェクトに
        }
      }
      return { ...tc, args: parsed };
    });
    return { ...msg, toolCalls: sanitized };
  });
  return dirty ? result : messages;
}

export interface SessionSlice {
  sessionList: SessionMeta[];
  activeSessionId: string | null;
  activeSessionSnapshot: Session | null;
  sessionLoading: boolean;

  setSessionList(list: SessionMeta[]): void;
  setActiveSession(session: Session): void;
  setActiveSessionId(id: string | null): void;
  setSessionLoading(v: boolean): void;
  loadSession(session: Session): void;
}

export const createSessionSlice: StateCreator<AppStore, [], [], SessionSlice> = (set, get) => ({
  sessionList: [],
  activeSessionId: null,
  activeSessionSnapshot: null,
  sessionLoading: false,

  setSessionList: (list) => set({ sessionList: list }),
  setActiveSession: (session) =>
    set({ activeSessionSnapshot: session, activeSessionId: session.id }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSessionLoading: (v) => set({ sessionLoading: v }),
  loadSession: (session) => {
    // 1. Clear UI artifacts
    get().clearArtifacts();

    // 2. Update session state (sanitize in case of corrupted data from IndexedDB)
    const messages = sanitizeMessages(session.messages);
    set({
      activeSessionSnapshot: session,
      activeSessionId: session.id,
      messages,
      history: session.history,
      shownSkillIds: new Set<string>(),
    });

    // 3. Close artifact panel
    get().setArtifactPanelOpen(false);

    // 4. Load artifacts for the new session
    void get().loadArtifacts();
  },
});
