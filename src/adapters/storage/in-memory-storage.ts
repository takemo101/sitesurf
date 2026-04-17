import type { ArtifactFile, ArtifactStoragePort } from "@/ports/artifact-storage";
import type { StoredToolResult, ToolResultStorePort } from "@/ports/tool-result-store";
import type { StoragePort } from "@/ports/storage";

export class InMemoryArtifactStorage implements ArtifactStoragePort {
  private artifacts = new Map<string, unknown>();
  private files = new Map<string, ArtifactFile>();

  async createOrUpdate(name: string, data: unknown): Promise<void> {
    this.artifacts.set(name, data);
  }

  async get(name: string): Promise<unknown | null> {
    return this.artifacts.get(name) ?? null;
  }

  async list(): Promise<string[]> {
    return Array.from(this.artifacts.keys());
  }

  async delete(name: string): Promise<void> {
    this.artifacts.delete(name);
  }

  async saveFile(name: string, contentBase64: string, mimeType: string): Promise<void> {
    this.files.set(name, {
      name,
      contentBase64,
      mimeType,
      size: Math.ceil(contentBase64.length * 0.75),
      createdAt: Date.now(),
    });
  }

  async getFile(name: string): Promise<ArtifactFile | null> {
    return this.files.get(name) ?? null;
  }

  async listFiles(): Promise<string[]> {
    return Array.from(this.files.keys());
  }

  async deleteFile(name: string): Promise<void> {
    this.files.delete(name);
  }

  async clearAll(): Promise<void> {
    this.artifacts.clear();
    this.files.clear();
  }

  setSessionId(_sessionId: string | null): void {}
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

export class InMemoryToolResultStore implements ToolResultStorePort {
  private results = new Map<string, StoredToolResult>();

  async save(
    sessionId: string,
    result: Omit<StoredToolResult, "createdAt" | "sessionId">,
  ): Promise<void> {
    this.results.set(result.key, {
      ...result,
      sessionId,
      createdAt: Date.now(),
    });
  }

  async get(sessionId: string, key: string): Promise<StoredToolResult | null> {
    const result = this.results.get(key);
    if (!result || result.sessionId !== sessionId) {
      return null;
    }
    return result;
  }

  async list(sessionId: string): Promise<StoredToolResult[]> {
    return [...this.results.values()]
      .filter((result) => result.sessionId === sessionId)
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  async deleteSession(sessionId: string): Promise<void> {
    for (const [key, result] of this.results.entries()) {
      if (result.sessionId === sessionId) {
        this.results.delete(key);
      }
    }
  }
}
