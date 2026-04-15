import type { ArtifactFile, ArtifactStoragePort } from "@/ports/artifact-storage";

const ARTIFACT_PREFIX = "tw_artifact_";
const FILE_PREFIX = "tw_file_";
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;

function sanitizeKey(name: string): string {
  return name.replace(/[./\\:*?"<>|]/g, "_");
}

export class ChromeArtifactStorage implements ArtifactStoragePort {
  private cache = new Map<string, unknown>();
  private sessionId: string | null = null;

  setSessionId(sessionId: string | null) {
    this.sessionId = sessionId;
    this.cache.clear();
  }

  private getArtifactPrefix(): string {
    return this.sessionId ? `${ARTIFACT_PREFIX}${this.sessionId}_` : ARTIFACT_PREFIX;
  }

  private getFilePrefix(): string {
    return this.sessionId ? `${FILE_PREFIX}${this.sessionId}_` : FILE_PREFIX;
  }

  private async checkQuota(bytesNeeded: number): Promise<boolean> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse(null);
      return bytesInUse + bytesNeeded < MAX_STORAGE_BYTES;
    } catch {
      return true;
    }
  }

  private estimateBase64Size(base64: string): number {
    return Math.ceil(base64.length * 0.75);
  }

  async createOrUpdate(name: string, data: unknown): Promise<void> {
    const key = this.getArtifactPrefix() + sanitizeKey(name);
    const artifact = { name, data, createdAt: Date.now(), updatedAt: Date.now() };
    const bytesNeeded = JSON.stringify(artifact).length;
    if (!(await this.checkQuota(bytesNeeded))) {
      throw new Error("Storage quota exceeded. Try deleting old artifacts first.");
    }
    await chrome.storage.local.set({ [key]: artifact });
    this.cache.set(key, data);
  }

  async get(name: string): Promise<unknown | null> {
    const key = this.getArtifactPrefix() + sanitizeKey(name);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const result = await chrome.storage.local.get(key);
    const artifact = result[key] as { data: unknown } | undefined;
    if (artifact) {
      this.cache.set(key, artifact.data);
      return artifact.data;
    }
    return null;
  }

  async list(): Promise<string[]> {
    const all = await chrome.storage.local.get(null);
    const prefix = this.getArtifactPrefix();
    const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
    return keys.map((k) => {
      const artifact = all[k] as { name: string } | undefined;
      return artifact?.name || k.slice(prefix.length);
    });
  }

  async delete(name: string): Promise<void> {
    const key = this.getArtifactPrefix() + sanitizeKey(name);
    await chrome.storage.local.remove(key);
    this.cache.delete(key);
  }

  async saveFile(name: string, contentBase64: string, mimeType: string): Promise<void> {
    const key = this.getFilePrefix() + sanitizeKey(name);
    const size = this.estimateBase64Size(contentBase64);
    if (size > 2 * 1024 * 1024) {
      console.warn(`[ArtifactStorage] Large file: ${name} (${(size / 1024 / 1024).toFixed(2)}MB)`);
    }
    if (!(await this.checkQuota(size))) {
      throw new Error("Storage quota exceeded. Cannot save file.");
    }
    const file: ArtifactFile = { name, contentBase64, mimeType, size, createdAt: Date.now() };
    await chrome.storage.local.set({ [key]: file });
  }

  async getFile(name: string): Promise<ArtifactFile | null> {
    const key = this.getFilePrefix() + sanitizeKey(name);
    const result = await chrome.storage.local.get(key);
    return (result[key] as ArtifactFile | undefined) ?? null;
  }

  async listFiles(): Promise<string[]> {
    const all = await chrome.storage.local.get(null);
    const prefix = this.getFilePrefix();
    const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
    return keys.map((k) => {
      const file = all[k] as ArtifactFile | undefined;
      return file?.name || k.slice(prefix.length);
    });
  }

  async deleteFile(name: string): Promise<void> {
    const key = this.getFilePrefix() + sanitizeKey(name);
    await chrome.storage.local.remove(key);
  }

  async clearAll(): Promise<void> {
    const all = await chrome.storage.local.get(null);
    const artifactPrefix = this.getArtifactPrefix();
    const filePrefix = this.getFilePrefix();
    const keysToRemove = Object.keys(all).filter(
      (k) => k.startsWith(artifactPrefix) || k.startsWith(filePrefix),
    );
    await chrome.storage.local.remove(keysToRemove);
    this.cache.clear();
  }
}
