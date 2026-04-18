import type { SystemPromptOptions } from "./system-prompt-v2";

const DEFAULT_MAX_ENTRIES = 10;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Build a stable, lightweight cache key for the base (static) sections of the system prompt.
 * Skills section is excluded from the cache because shownSkillIds changes per turn.
 */
export function createPromptCacheKey(options: SystemPromptOptions): string {
  const parts: string[] = [`locale:${options.locale ?? "default"}`];

  return parts.join("|");
}

export class PromptCache {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(maxEntries = DEFAULT_MAX_ENTRIES, ttlMs = DEFAULT_TTL_MS) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU ordering
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: string): void {
    const entry: CacheEntry = {
      value,
      expiresAt: Date.now() + this.ttlMs,
    };

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, entry);

    if (this.cache.size <= this.maxEntries) {
      return;
    }

    const oldestKey = this.cache.keys().next().value;

    if (oldestKey === undefined) {
      throw new Error("PromptCache eviction failed: no oldest key");
    }

    this.cache.delete(oldestKey);
  }

  clear(): void {
    this.cache.clear();
  }
}
