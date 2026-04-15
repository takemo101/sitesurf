import type { StoragePort } from "@/ports/storage";

export class ChromeStorageAdapter implements StoragePort {
  async get<T>(key: string): Promise<T | null> {
    const data = await chrome.storage.local.get([key]);
    return (data[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
