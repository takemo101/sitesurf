import type { SkillRegistry } from "@/shared/skill-registry";

export function createSkillRegistryRuntime(loader: () => Promise<SkillRegistry>) {
  let current: SkillRegistry | null = null;
  let pending: Promise<SkillRegistry> | null = null;
  let requestId = 0;

  const triggerReload = async (): Promise<SkillRegistry> => {
    requestId += 1;
    const currentRequestId = requestId;
    const next = loader().then((registry) => {
      if (pending === next) {
        pending = null;
      }
      if (currentRequestId === requestId) {
        current = registry;
      }
      return registry;
    });

    pending = next;
    return next;
  };

  const waitForReady = async (): Promise<SkillRegistry | null> => {
    if (pending) {
      await pending;
    }
    return current;
  };

  return {
    triggerReload,
    waitForReady,
  };
}
