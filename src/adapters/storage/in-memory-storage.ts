import type { ArtifactFile, ArtifactStoragePort } from "@/ports/artifact-storage";
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

