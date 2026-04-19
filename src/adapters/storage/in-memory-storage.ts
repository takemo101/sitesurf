import type {
  ArtifactFile,
  ArtifactMeta,
  ArtifactStoragePort,
  ArtifactValue,
} from "@/ports/artifact-storage";
import type { StoragePort } from "@/ports/storage";

const GLOBAL_SESSION_KEY = "__global__";

type StoredArtifact = ArtifactMeta & {
  key: string;
  sessionId: string | null;
  data?: unknown;
  bytes?: Uint8Array;
};

export class InMemoryArtifactStorage implements ArtifactStoragePort {
  private artifacts = new Map<string, StoredArtifact>();
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

  async createOrUpdate(name: string, data: unknown): Promise<void> {
    await this.put(name, { kind: "json", data });
  }

  async saveFile(name: string, contentBase64: string, mimeType: string): Promise<void> {
    await this.put(name, {
      kind: "file",
      bytes: base64ToBytes(contentBase64),
      mimeType,
    });
  }

  async getFile(name: string): Promise<ArtifactFile | null> {
    const value = await this.get(name);
    if (!value || value.kind !== "file") {
      return null;
    }

    const artifact = this.artifacts.get(this.createKey(name));
    if (!artifact) {
      return null;
    }

    return {
      name,
      contentBase64: bytesToBase64(value.bytes),
      mimeType: value.mimeType,
      size: value.bytes.byteLength,
      createdAt: artifact.createdAt,
    };
  }

  async listFiles(): Promise<string[]> {
    const artifacts = await this.list();
    return artifacts
      .filter((artifact) => artifact.kind === "file")
      .map((artifact) => artifact.name);
  }

  async deleteFile(name: string): Promise<void> {
    const value = await this.get(name);
    if (value?.kind === "file") {
      await this.delete(name);
    }
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

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}
