import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { createLazyRouteModule, getProgressiveRouteTasks } from "../index";

describe("createLazyRouteModule", () => {
  it("preload は import Promise を 1 回だけ作る", async () => {
    const View = (() => null) as ComponentType;
    const loader = vi.fn(async () => ({ View }));

    const route = createLazyRouteModule(loader, "View");
    const first = route.preload();
    const second = route.preload();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    const loaded = await first;
    expect(loaded.View).toBe(View);
  });

  it("failed preload can be retried", async () => {
    const View = (() => null) as ComponentType;
    const loader = vi
      .fn<() => Promise<{ View: ComponentType }>>()
      .mockRejectedValueOnce(new Error("load failed"))
      .mockResolvedValueOnce({ View });

    const route = createLazyRouteModule(loader, "View");

    await expect(route.preload()).rejects.toThrow("load failed");

    const loaded = await route.preload();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loaded.View).toBe(View);
  });
});

describe("getProgressiveRouteTasks", () => {
  it("chat を high、settings を medium、artifacts を low priority で返す", () => {
    const tasks = getProgressiveRouteTasks();

    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({ key: "chat", priority: 2 });
    expect(tasks[1]).toMatchObject({ key: "settings", priority: 3 });
    expect(tasks[2]).toMatchObject({ key: "artifacts", priority: 4 });
  });
});
