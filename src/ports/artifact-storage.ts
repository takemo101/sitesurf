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

export interface ArtifactStoragePort {
  put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void>;
  get(name: string): Promise<ArtifactValue | null>;
  list(): Promise<ArtifactMeta[]>;
  delete(name: string): Promise<void>;
  clearAll(): Promise<void>;
  setSessionId(sessionId: string | null): void;
}
