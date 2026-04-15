import type { AIMessage } from "@/ports/ai-provider";
import type { SessionStoragePort } from "@/ports/session-storage";
import type { Session, ChatMessage } from "@/ports/session-types";
import { createLogger } from "@/shared/logger";

import { buildSaveData } from "./save-builder";

const DEBOUNCE_MS = 2000;
const log = createLogger("auto-save");

export interface AutoSaverState {
  activeSessionSnapshot: Session | null;
  messages: ChatMessage[];
  history: AIMessage[];
}

export interface AutoSaverCallbacks {
  onTitleChanged?: (title: string) => void;
}

export function createAutoSaver(
  sessionStorage: SessionStoragePort,
  getState: () => AutoSaverState,
  callbacks?: AutoSaverCallbacks,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = async () => {
    const state = getState();
    if (!state.activeSessionSnapshot) return;
    const { session, meta } = buildSaveData(state.activeSessionSnapshot, state);
    log.debug("セッション保存", { id: session.id });
    await sessionStorage.saveSession(session, meta);

    if (session.title !== state.activeSessionSnapshot.title) {
      callbacks?.onTitleChanged?.(session.title);
    }
  };

  return {
    scheduleSave() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, DEBOUNCE_MS);
    },

    async saveImmediately() {
      if (timer) clearTimeout(timer);
      timer = null;
      await save();
    },

    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
