import type { StoragePort } from "@/ports/storage";
import type { AuditLogger, SecurityEvent } from "./types";

export const SECURITY_AUDIT_LOG_KEY = "sitesurf_security_audit_log";
const DEFAULT_MAX_ENTRIES = 100;

export interface SecurityAuditLogEntry extends SecurityEvent {
  id: string;
  createdAt: number;
}

export interface SecurityAuditLoggerOptions {
  maxEntries?: number;
}

export interface SecurityAuditReadOptions {
  limit?: number;
}

export function createStorageBackedSecurityAuditLogger(
  storage: StoragePort,
  options: SecurityAuditLoggerOptions = {},
): AuditLogger {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  return {
    async logSecurityEvent(event: SecurityEvent): Promise<void> {
      const existing = (await storage.get<SecurityAuditLogEntry[]>(SECURITY_AUDIT_LOG_KEY)) ?? [];
      const entry: SecurityAuditLogEntry = {
        source: event.source,
        sessionId: event.sessionId,
        confidence: event.confidence,
        matches: event.matches,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };

      await storage.set(SECURITY_AUDIT_LOG_KEY, [entry, ...existing].slice(0, maxEntries));
    },
  };
}

export async function loadSecurityAuditLog(
  storage: StoragePort,
  options: SecurityAuditReadOptions = {},
): Promise<SecurityAuditLogEntry[]> {
  const limit = options.limit ?? DEFAULT_MAX_ENTRIES;
  const existing = (await storage.get<SecurityAuditLogEntry[]>(SECURITY_AUDIT_LOG_KEY)) ?? [];
  return existing.slice(0, limit);
}
