import { useEffect, useRef } from "react";

export type LoadingPriority = 1 | 2 | 3 | 4;

export interface ProgressiveLoadingTask {
  key: string;
  priority: LoadingPriority;
  load: () => void | Promise<unknown>;
  enabled?: boolean;
}

const PROGRESSIVE_LOADING_DELAYS: Record<LoadingPriority, number> = {
  1: 0,
  2: 500,
  3: 1000,
  4: 2000,
};

export function getProgressiveLoadingDelay(priority: LoadingPriority): number {
  return PROGRESSIVE_LOADING_DELAYS[priority];
}

export function scheduleProgressiveLoading(
  tasks: readonly ProgressiveLoadingTask[],
  schedule: typeof setTimeout = setTimeout,
  cancel: typeof clearTimeout = clearTimeout,
): () => void {
  const handles = tasks
    .filter((task) => task.enabled !== false)
    .sort((a, b) => a.priority - b.priority)
    .map((task) =>
      schedule(() => {
        void Promise.resolve(task.load()).catch(() => undefined);
      }, getProgressiveLoadingDelay(task.priority)),
    );

  return () => {
    for (const handle of handles) {
      cancel(handle);
    }
  };
}

export function useProgressiveLoading(tasks: readonly ProgressiveLoadingTask[]): void {
  const loadedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    const pendingTasks = tasks
      .filter((task) => task.enabled !== false)
      .filter((task) => !loadedKeysRef.current.has(task.key))
      .map((task) => ({
        ...task,
        load: async () => {
          await task.load();
          loadedKeysRef.current.add(task.key);
        },
      }));

    return scheduleProgressiveLoading(pendingTasks);
  }, [tasks]);
}
