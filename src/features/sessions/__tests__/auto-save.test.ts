import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { SessionStoragePort } from "@/ports/session-storage";
import type { Session } from "@/ports/session-types";

import { createAutoSaver, type AutoSaverState } from "../auto-save";

function makeSession(): Session {
  return {
    id: "sess-1",
    title: "テスト",
    createdAt: "2025-01-01T00:00:00.000Z",
    model: "claude-sonnet-4-20250514",
    messages: [],
    history: [],
  };
}

function makeState(overrides: Partial<AutoSaverState> = {}): AutoSaverState {
  return {
    activeSessionSnapshot: makeSession(),
    messages: [],
    history: [],
    ...overrides,
  };
}

function makeMockStorage(): SessionStoragePort {
  return {
    listSessions: vi.fn().mockResolvedValue([]),
    getMetadata: vi.fn().mockResolvedValue(null),
    getLatestSessionId: vi.fn().mockResolvedValue(null),
    getSession: vi.fn().mockResolvedValue(null),
    saveSession: vi.fn().mockResolvedValue(undefined),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createAutoSaver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scheduleSave は 2 秒後に保存する", async () => {
    const storage = makeMockStorage();
    const state = makeState();
    const saver = createAutoSaver(storage, () => state);

    saver.scheduleSave();

    expect(storage.saveSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);

    expect(storage.saveSession).toHaveBeenCalledTimes(1);
    saver.dispose();
  });

  it("scheduleSave を連続呼出しするとデバウンスされる", async () => {
    const storage = makeMockStorage();
    const state = makeState();
    const saver = createAutoSaver(storage, () => state);

    saver.scheduleSave();
    await vi.advanceTimersByTimeAsync(1000);
    saver.scheduleSave();
    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.saveSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(storage.saveSession).toHaveBeenCalledTimes(1);
    saver.dispose();
  });

  it("saveImmediately は即座に保存する", async () => {
    const storage = makeMockStorage();
    const state = makeState();
    const saver = createAutoSaver(storage, () => state);

    await saver.saveImmediately();

    expect(storage.saveSession).toHaveBeenCalledTimes(1);
    saver.dispose();
  });

  it("saveImmediately は pending の timer をキャンセルする", async () => {
    const storage = makeMockStorage();
    const state = makeState();
    const saver = createAutoSaver(storage, () => state);

    saver.scheduleSave();
    await saver.saveImmediately();

    await vi.advanceTimersByTimeAsync(3000);
    expect(storage.saveSession).toHaveBeenCalledTimes(1);
    saver.dispose();
  });

  it("activeSessionSnapshot が null の場合は保存しない", async () => {
    const storage = makeMockStorage();
    const state = makeState({ activeSessionSnapshot: null });
    const saver = createAutoSaver(storage, () => state);

    await saver.saveImmediately();

    expect(storage.saveSession).not.toHaveBeenCalled();
    saver.dispose();
  });

  it("dispose で timer をクリアする", async () => {
    const storage = makeMockStorage();
    const state = makeState();
    const saver = createAutoSaver(storage, () => state);

    saver.scheduleSave();
    saver.dispose();

    await vi.advanceTimersByTimeAsync(3000);
    expect(storage.saveSession).not.toHaveBeenCalled();
  });
});
