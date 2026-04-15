import type { StoragePort } from "@/ports/storage";
import { loadSecurityAuditLog, type SecurityAuditLogEntry } from "@/features/security/audit-logger";

export type { SecurityAuditLogEntry };

export async function loadSecurityAuditEntries(
  storage: StoragePort,
  limit = 20,
): Promise<SecurityAuditLogEntry[]> {
  return loadSecurityAuditLog(storage, { limit });
}
