import type { SessionStoragePort } from "@/ports/session-storage";

export interface SessionLocks {
  [sessionId: string]: number;
}

export interface SessionStoreDeps {
  sessionStorage: SessionStoragePort;
  acquireLock: (sessionId: string) => Promise<{ success: boolean }>;
  releaseLock: (sessionId: string) => Promise<void>;
  getSessionLocks: () => Promise<SessionLocks>;
}
