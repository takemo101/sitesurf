import type { Session, SessionMeta } from "@/ports/session-types";

export interface SessionStoragePort {
  listSessions(): Promise<SessionMeta[]>;
  getMetadata(id: string): Promise<SessionMeta | null>;
  getLatestSessionId(): Promise<string | null>;
  getSession(id: string): Promise<Session | null>;
  saveSession(session: Session, meta: SessionMeta): Promise<void>;
  updateTitle(id: string, title: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
