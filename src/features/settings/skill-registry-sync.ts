const listeners = new Set<() => void>();

export function subscribeSkillRegistryReload(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySkillRegistryReload(): void {
  for (const listener of listeners) {
    listener();
  }
}
