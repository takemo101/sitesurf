import type { Session, SessionMeta } from "@/ports/session-types";
import { createLogger } from "@/shared/logger";

import type { SessionStoreDeps } from "./types";

const log = createLogger("session-store");

const TITLE_MAX_LENGTH = 50;
export const DEFAULT_TITLE = "新しい会話";

interface StoreActions {
  setSessionList(list: SessionMeta[]): void;
  setArtifactSessionId(sessionId: string | null): void;
  loadSession(session: Session): void;
  setSessionLoading(v: boolean): void;
  clearAll(): void;
}

function updateArtifactSessionId(store: StoreActions, sessionId: string | null): void {
  store.setArtifactSessionId(sessionId);
}

function generateTitle(firstMessage: string): string {
  const text = firstMessage.replace(/\n/g, " ").trim();
  if (!text) return DEFAULT_TITLE;
  return text.length > TITLE_MAX_LENGTH ? text.substring(0, TITLE_MAX_LENGTH) + "…" : text;
}

export async function loadSessionList(deps: SessionStoreDeps, store: StoreActions): Promise<void> {
  const list = await deps.sessionStorage.listSessions();
  store.setSessionList(list);
}

export async function createSession(
  deps: SessionStoreDeps,
  store: StoreActions,
  model: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const session: Session = {
    id,
    title: DEFAULT_TITLE,
    createdAt: now,
    model,
    messages: [],
    history: [],
  };

  const meta: SessionMeta = {
    id,
    title: session.title,
    createdAt: now,
    lastModified: now,
    messageCount: 0,
    modelId: model,
    preview: "",
  };

  await deps.sessionStorage.saveSession(session, meta);
  updateArtifactSessionId(store, session.id);
  store.loadSession(session);

  const list = await deps.sessionStorage.listSessions();
  store.setSessionList(list);

  return id;
}

export async function switchSession(
  deps: SessionStoreDeps,
  store: StoreActions,
  id: string,
): Promise<void> {
  log.info("セッション切替", { id });
  store.setSessionLoading(true);
  try {
    const lockResult = await deps.acquireLock(id);
    if (!lockResult.success) {
      throw new Error(`セッション ${id} は別のウィンドウで使用中です`);
    }

    const session = await deps.sessionStorage.getSession(id);
    if (!session) {
      throw new Error(`セッション ${id} が見つかりません`);
    }

    updateArtifactSessionId(store, session.id);
    store.loadSession(session);
  } finally {
    store.setSessionLoading(false);
  }
}

export async function deleteSession(
  deps: SessionStoreDeps,
  store: StoreActions,
  id: string,
  activeSessionId: string | null,
): Promise<void> {
  if (id === activeSessionId) {
    throw new Error("使用中のセッションは削除できません");
  }

  await deps.sessionStorage.deleteSession(id);

  const list = await deps.sessionStorage.listSessions();
  store.setSessionList(list);
}

export async function renameSession(
  deps: SessionStoreDeps,
  store: StoreActions,
  id: string,
  title: string,
  activeSessionSnapshot: Session | null,
): Promise<void> {
  await deps.sessionStorage.updateTitle(id, title);

  if (activeSessionSnapshot && activeSessionSnapshot.id === id) {
    updateArtifactSessionId(store, id);
    store.loadSession({ ...activeSessionSnapshot, title });
  }

  const list = await deps.sessionStorage.listSessions();
  store.setSessionList(list);
}

export { generateTitle };
