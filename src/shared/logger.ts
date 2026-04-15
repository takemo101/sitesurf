export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

export function createLogger(module: string): Logger {
  const prefix = `[SiteSurf:${module}]`;
  return {
    debug: (msg, data) => console.debug(prefix, msg, data ?? ""),
    info: (msg, data) => console.info(prefix, msg, data ?? ""),
    warn: (msg, data) => console.warn(prefix, msg, data ?? ""),
    error: (msg, err) => console.error(prefix, msg, err ?? ""),
  };
}
