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

export interface ArtifactFile {
  name: string;
  contentBase64: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface ArtifactStoragePort {
  put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void>;
  get(name: string): Promise<ArtifactValue | null>;
  list(): Promise<ArtifactMeta[]>;
  delete(name: string): Promise<void>;
  clearAll(): Promise<void>;
  setSessionId(sessionId: string | null): void;

  /** @deprecated ADR-007 step 2 (#133) will replace callers with `put({ kind: "json", data })`. */
  createOrUpdate(name: string, data: unknown): Promise<void>;
  /** @deprecated ADR-007 step 2 (#133) will replace callers with `put({ kind: "file", bytes, mimeType })`. */
  saveFile(name: string, contentBase64: string, mimeType: string): Promise<void>;
  /** @deprecated ADR-007 step 2 (#133) will replace callers with `get()` + base64 encode at the boundary. */
  getFile(name: string): Promise<ArtifactFile | null>;
  /** @deprecated ADR-007 step 2 (#133) will replace callers with `list()` filtered by kind. */
  listFiles(): Promise<string[]>;
  /** @deprecated ADR-007 step 2 (#133) will replace callers with `delete()`. */
  deleteFile(name: string): Promise<void>;
}
