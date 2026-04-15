import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPromptCacheKey, PromptCache } from "../prompt-cache";

describe("createPromptCacheKey", () => {
  it("returns same key for same options", () => {
    const options = {
      includeSkills: true,
      locale: "ja-JP",
      skills: [],
    };

    const firstKey = createPromptCacheKey(options);
    const secondKey = createPromptCacheKey(options);

    expect(firstKey).toBe(secondKey);
  });

  it("returns different key for different options", () => {
    const firstKey = createPromptCacheKey({ includeSkills: true });
    const secondKey = createPromptCacheKey({ includeSkills: false });

    expect(firstKey).not.toBe(secondKey);
  });

  it("produces stable key regardless of skill object property order", () => {
    const makeSkill = (id: string) => ({
      skill: {
        id,
        name: "s",
        description: "d",
        matchers: { hosts: [] },
        version: "0.0.0",
        extractors: [],
      },
      availableExtractors: [],
      confidence: 0,
    });

    const key1 = createPromptCacheKey({
      includeSkills: true,
      skills: [makeSkill("a"), makeSkill("b")],
    });
    const key2 = createPromptCacheKey({
      includeSkills: true,
      skills: [makeSkill("b"), makeSkill("a")],
    });

    expect(key1).toBe(key2);
  });
});

describe("PromptCache", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns cached value for same key", () => {
    const cache = new PromptCache();

    cache.set("same-key", "first value");

    expect(cache.get("same-key")).toBe("first value");
    expect(cache.get("same-key")).toBe("first value");
  });

  it("evicts least recently used entry when max size is exceeded", () => {
    const cache = new PromptCache(2, 5 * 60 * 1000);

    cache.set("a", "value-a");
    cache.set("b", "value-b");

    expect(cache.get("a")).toBe("value-a");

    cache.set("c", "value-c");

    expect(cache.get("a")).toBe("value-a");
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBe("value-c");
  });

  it("expires entries after ttl", () => {
    vi.useFakeTimers();
    const cache = new PromptCache(10, 1000);

    cache.set("ttl", "value");
    vi.advanceTimersByTime(1001);

    expect(cache.get("ttl")).toBeNull();
  });

  it("overwrites existing entry with same key", () => {
    const cache = new PromptCache();

    cache.set("key", "original");
    cache.set("key", "updated");

    expect(cache.get("key")).toBe("updated");
  });

  it("clears all entries", () => {
    const cache = new PromptCache();

    cache.set("a", "value-a");
    cache.set("b", "value-b");
    cache.clear();

    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });
});
