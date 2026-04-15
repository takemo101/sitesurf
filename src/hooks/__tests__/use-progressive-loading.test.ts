import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getProgressiveLoadingDelay,
  scheduleProgressiveLoading,
  type ProgressiveLoadingTask,
} from "../use-progressive-loading";

describe("getProgressiveLoadingDelay", () => {
  it("priority 1-4 を期待された遅延時間へ変換する", () => {
    expect(getProgressiveLoadingDelay(1)).toBe(0);
    expect(getProgressiveLoadingDelay(2)).toBe(500);
    expect(getProgressiveLoadingDelay(3)).toBe(1000);
    expect(getProgressiveLoadingDelay(4)).toBe(2000);
  });
});

describe("scheduleProgressiveLoading", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("priority 順に enabled な task だけ実行する", () => {
    vi.useFakeTimers();

    const calls: string[] = [];
    const tasks: ProgressiveLoadingTask[] = [
      { key: "artifacts", priority: 3, load: () => void calls.push("artifacts") },
      { key: "chat", priority: 1, load: () => void calls.push("chat") },
      { key: "settings", priority: 2, enabled: false, load: () => void calls.push("settings") },
      { key: "settings-panel", priority: 2, load: () => void calls.push("settings-panel") },
    ];

    scheduleProgressiveLoading(tasks);

    vi.advanceTimersByTime(0);
    expect(calls).toStrictEqual(["chat"]);

    vi.advanceTimersByTime(499);
    expect(calls).toStrictEqual(["chat"]);

    vi.advanceTimersByTime(1);
    expect(calls).toStrictEqual(["chat", "settings-panel"]);

    vi.advanceTimersByTime(500);
    expect(calls).toStrictEqual(["chat", "settings-panel", "artifacts"]);
  });

  it("cleanup 後は未実行 task をキャンセルする", () => {
    vi.useFakeTimers();

    const calls: string[] = [];
    const cleanup = scheduleProgressiveLoading([
      { key: "chat", priority: 1, load: () => void calls.push("chat") },
      { key: "artifacts", priority: 4, load: () => void calls.push("artifacts") },
    ]);

    vi.advanceTimersByTime(0);
    expect(calls).toStrictEqual(["chat"]);

    cleanup();
    vi.advanceTimersByTime(2000);
    expect(calls).toStrictEqual(["chat"]);
  });
});
