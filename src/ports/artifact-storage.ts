export interface Artifact {
  name: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface ArtifactFile {
  name: string;
  contentBase64: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface ArtifactStoragePort {
  createOrUpdate(name: string, data: unknown): Promise<void>;
  get(name: string): Promise<unknown | null>;
  list(): Promise<string[]>;
  delete(name: string): Promise<void>;
  saveFile(name: string, contentBase64: string, mimeType: string): Promise<void>;
  getFile(name: string): Promise<ArtifactFile | null>;
  listFiles(): Promise<string[]>;
  deleteFile(name: string): Promise<void>;
  clearAll(): Promise<void>;
  /** Set session ID for isolating artifacts per session */
  setSessionId(sessionId: string | null): void;
}

// --- Unified Artifact Storage (ADR-007) ---

export type ArtifactKind = "json" | "file";

export interface ArtifactMeta {
  name: string;
  kind: ArtifactKind;
  mimeType?: string;
  size: number;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ArtifactValue =
  | { kind: "json"; data: unknown }
  | { kind: "file"; bytes: Uint8Array; mimeType: string };

export interface UnifiedArtifactStoragePort {
  put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void>;
  get(name: string): Promise<ArtifactValue | null>;
  list(): Promise<ArtifactMeta[]>;
  delete(name: string): Promise<void>;
  setSessionId(sessionId: string | null): void;
  clearAll(): Promise<void>;
}
