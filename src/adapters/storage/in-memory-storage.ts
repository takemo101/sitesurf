import type { ArtifactMeta, ArtifactStoragePort, ArtifactValue } from "@/ports/artifact-storage";
import type { StoragePort } from "@/ports/storage";
import { GLOBAL_SESSION_KEY, type StoredArtifactRecord } from "./artifact-record";

export class InMemoryArtifactStorage implements ArtifactStoragePort {
  private artifacts = new Map<string, StoredArtifactRecord>();
  private sessionId: string | null = null;

  async put(name: string, value: ArtifactValue, options?: { visible?: boolean }): Promise<void> {
    const key = this.createKey(name);
    const existing = this.artifacts.get(key);
    const now = Date.now();

    this.artifacts.set(key, {
      key,
      sessionId: this.sessionId,
      name,
      kind: value.kind,
      mimeType: value.kind === "file" ? value.mimeType : undefined,
      size: value.kind === "file" ? value.bytes.byteLength : this.getJsonSize(value.data),
      visible: options?.visible ?? existing?.visible ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      data: value.kind === "json" ? value.data : undefined,
      bytes: value.kind === "file" ? value.bytes : undefined,
    });
  }

  async get(name: string): Promise<ArtifactValue | null> {
    const artifact = this.artifacts.get(this.createKey(name));
    if (!artifact) {
      return null;
    }

    if (artifact.kind === "json") {
      return { kind: "json", data: artifact.data };
    }

    return {
      kind: "file",
      bytes: artifact.bytes ?? new Uint8Array(),
      mimeType: artifact.mimeType ?? "application/octet-stream",
    };
  }

  async list(): Promise<ArtifactMeta[]> {
    return Array.from(this.artifacts.values())
      .filter((artifact) => artifact.sessionId === this.sessionId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ name, kind, mimeType, size, visible, createdAt, updatedAt }) => ({
        name,
        kind,
        mimeType,
        size,
        visible,
        createdAt,
        updatedAt,
      }));
  }

  async delete(name: string): Promise<void> {
    this.artifacts.delete(this.createKey(name));
  }

  async clearAll(): Promise<void> {
    for (const [key, artifact] of this.artifacts.entries()) {
      if (artifact.sessionId === this.sessionId) {
        this.artifacts.delete(key);
      }
    }
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  private createKey(name: string): string {
    return `${this.sessionId ?? GLOBAL_SESSION_KEY}::${name}`;
  }

  private getJsonSize(data: unknown): number {
    return new TextEncoder().encode(JSON.stringify(data)).byteLength;
  }
}

export class InMemoryStorage implements StoragePort {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}
