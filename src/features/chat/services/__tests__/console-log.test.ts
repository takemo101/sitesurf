import { describe, expect, it } from "vitest";
import { ConsoleLogService, normalizeConsoleLogEntry } from "../console-log";

describe("ConsoleLogService", () => {
  it("toolCallId ごとにログを蓄積できる", () => {
    const service = new ConsoleLogService();

    service.append("tool-1", {
      level: "log",
      message: "first",
      timestamp: 1,
    });
    service.append("tool-1", {
      level: "error",
      message: "second",
      timestamp: 2,
    });

    expect(service.get("tool-1").map((entry) => entry.message)).toStrictEqual(["first", "second"]);
  });

  it("未知の toolCallId では空配列を返す", () => {
    const service = new ConsoleLogService();

    expect(service.get("missing")).toStrictEqual([]);
  });

  it("clear で対象 toolCallId のログだけ消せる", () => {
    const service = new ConsoleLogService();

    service.append("tool-1", { level: "log", message: "first", timestamp: 1 });
    service.append("tool-2", { level: "warn", message: "second", timestamp: 2 });

    service.clear("tool-1");

    expect(service.get("tool-1")).toStrictEqual([]);
    expect(service.get("tool-2")).toHaveLength(1);
  });

  it("subscribe で realtime に変更を受け取れる", () => {
    const service = new ConsoleLogService();
    const snapshots: string[][] = [];

    const unsubscribe = service.subscribe("tool-1", (entries) => {
      snapshots.push(entries.map((entry) => entry.message));
    });

    service.append("tool-1", { level: "log", message: "first", timestamp: 1 });
    service.append("tool-1", { level: "warn", message: "second", timestamp: 2 });
    unsubscribe();
    service.append("tool-1", { level: "error", message: "third", timestamp: 3 });

    expect(snapshots).toStrictEqual([[], ["first"], ["first", "second"]]);
  });
});

describe("normalizeConsoleLogEntry", () => {
  it("[WARN] プレフィックスを warn レベルに正規化する", () => {
    const entry = normalizeConsoleLogEntry("[WARN] something happened", 10);

    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("something happened");
    expect(entry.timestamp).toBe(10);
  });

  it("プレフィックスがない場合は log レベルとして扱う", () => {
    const entry = normalizeConsoleLogEntry("plain output", 20);

    expect(entry.level).toBe("log");
    expect(entry.message).toBe("plain output");
    expect(entry.timestamp).toBe(20);
  });
});
