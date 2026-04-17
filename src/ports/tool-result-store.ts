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
  save(sessionId: string, result: Omit<StoredToolResult, "createdAt" | "sessionId">): Promise<void>;
  get(sessionId: string, key: string): Promise<StoredToolResult | null>;
  list(sessionId: string): Promise<StoredToolResult[]>;
  deleteSession(sessionId: string): Promise<void>;
}
