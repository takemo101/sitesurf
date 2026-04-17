import type { SessionStoragePort } from "@/ports/session-storage";
import type { ToolResultStorePort } from "@/ports/tool-result-store";

export interface SessionLocks {
  [sessionId: string]: number;
}

export interface SessionStoreDeps {
  sessionStorage: SessionStoragePort;
  toolResultStore: ToolResultStorePort;
  acquireLock: (sessionId: string) => Promise<{ success: boolean }>;
  releaseLock: (sessionId: string) => Promise<void>;
  getSessionLocks: () => Promise<SessionLocks>;
}
