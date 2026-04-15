export type ConsoleLogLevel = "log" | "info" | "warn" | "error";

export interface ConsoleLogEntry {
  id: string;
  level: ConsoleLogLevel;
  message: string;
  timestamp: number;
}

const LOG_PREFIXES: Array<{ prefix: string; level: ConsoleLogLevel }> = [
  { prefix: "[ERROR] ", level: "error" },
  { prefix: "[WARN] ", level: "warn" },
  { prefix: "[INFO] ", level: "info" },
];

export function normalizeConsoleLogEntry(raw: string, timestamp = Date.now()): ConsoleLogEntry {
  const matchedPrefix = LOG_PREFIXES.find(({ prefix }) => raw.startsWith(prefix));
  const level = matchedPrefix?.level ?? "log";
  const message = matchedPrefix ? raw.slice(matchedPrefix.prefix.length) : raw;

  return {
    id: crypto.randomUUID(),
    level,
    message,
    timestamp,
  };
}

export class ConsoleLogService {
  private readonly logsByToolCallId = new Map<string, ConsoleLogEntry[]>();
  private readonly listeners = new Map<string, Set<(entries: ConsoleLogEntry[]) => void>>();

  subscribe(toolCallId: string, listener: (entries: ConsoleLogEntry[]) => void): () => void {
    const listeners =
      this.listeners.get(toolCallId) ?? new Set<(entries: ConsoleLogEntry[]) => void>();
    listeners.add(listener);
    this.listeners.set(toolCallId, listeners);
    listener(this.get(toolCallId));

    return () => {
      const currentListeners = this.listeners.get(toolCallId);
      if (!currentListeners) return;
      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        this.listeners.delete(toolCallId);
      }
    };
  }

  append(toolCallId: string, entry: Omit<ConsoleLogEntry, "id">): void {
    const current = this.logsByToolCallId.get(toolCallId) ?? [];
    const nextEntries = [
      ...current,
      {
        ...entry,
        id: crypto.randomUUID(),
      },
    ];
    this.logsByToolCallId.set(toolCallId, nextEntries);
    this.notify(toolCallId, nextEntries);
  }

  get(toolCallId: string): ConsoleLogEntry[] {
    return [...(this.logsByToolCallId.get(toolCallId) ?? [])];
  }

  clear(toolCallId: string): void {
    this.logsByToolCallId.delete(toolCallId);
    this.notify(toolCallId, []);
  }

  private notify(toolCallId: string, entries: ConsoleLogEntry[]): void {
    const listeners = this.listeners.get(toolCallId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener([...entries]);
    }
  }
}

export const defaultConsoleLogService = new ConsoleLogService();
