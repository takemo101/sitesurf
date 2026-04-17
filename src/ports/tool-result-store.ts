export interface StoredToolResult {
  key: string;
  sessionId: string;
  toolName: string;
  fullValue: string;
  summary: string;
  createdAt: number;
  turnIndex: number;
}

export interface ToolResultStorePort {
  /**
   * Layer 3 optimization only. Callers must fail-open and fall back to summary-only when this rejects.
   */
  save(sessionId: string, result: Omit<StoredToolResult, "createdAt" | "sessionId">): Promise<void>;
  /**
   * Layer 3 optimization only. Callers must convert failures into a tool error instead of breaking the agent loop.
   */
  get(sessionId: string, key: string): Promise<StoredToolResult | null>;
  list(sessionId: string): Promise<StoredToolResult[]>;
  /**
   * Best-effort cleanup. Session deletion should continue even when this rejects.
   */
  deleteSession(sessionId: string): Promise<void>;
}
