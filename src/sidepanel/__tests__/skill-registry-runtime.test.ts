import { describe, expect, it } from "vitest";

import { SkillRegistry } from "@/features/tools/skills";

import { createSkillRegistryRuntime } from "../skill-registry-runtime";

describe("skill-registry-runtime", () => {
  it("waits for an in-flight reload before returning registry", async () => {
    let resolve!: (registry: SkillRegistry) => void;
    const runtime = createSkillRegistryRuntime(
      () =>
        new Promise<SkillRegistry>((done) => {
          resolve = done;
        }),
    );

    const reloadPromise = runtime.triggerReload();
    const waitPromise = runtime.waitForReady();

    const registry = new SkillRegistry();
    resolve(registry);

    await expect(reloadPromise).resolves.toBe(registry);
    await expect(waitPromise).resolves.toBe(registry);
  });

  it("keeps the latest registry when older reload resolves last", async () => {
    let resolveFirst!: (registry: SkillRegistry) => void;
    let resolveSecond!: (registry: SkillRegistry) => void;
    let callCount = 0;

    const runtime = createSkillRegistryRuntime(() => {
      callCount += 1;
      return new Promise<SkillRegistry>((done) => {
        if (callCount === 1) {
          resolveFirst = done;
        } else {
          resolveSecond = done;
        }
      });
    });

    const firstReload = runtime.triggerReload();
    const secondReload = runtime.triggerReload();

    const newer = new SkillRegistry();
    const older = new SkillRegistry();
    resolveSecond(newer);
    await expect(secondReload).resolves.toBe(newer);

    resolveFirst(older);
    await expect(firstReload).resolves.toBe(older);

    await expect(runtime.waitForReady()).resolves.toBe(newer);
  });
});
