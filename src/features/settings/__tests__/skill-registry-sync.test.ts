import { describe, expect, it, vi } from "vitest";

import { notifySkillRegistryReload, subscribeSkillRegistryReload } from "../skill-registry-sync";

describe("skill-registry-sync", () => {
  it("notifies subscribers when skills change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSkillRegistryReload(listener);

    notifySkillRegistryReload();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
