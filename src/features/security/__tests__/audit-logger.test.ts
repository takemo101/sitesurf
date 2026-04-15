import { describe, expect, it } from "vitest";
import { InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import {
  createStorageBackedSecurityAuditLogger,
  loadSecurityAuditLog,
  SECURITY_AUDIT_LOG_KEY,
  type SecurityAuditLogEntry,
} from "../audit-logger";

describe("createStorageBackedSecurityAuditLogger", () => {
  it("stores a new security event with timestamp and id", async () => {
    const storage = new InMemoryStorage();
    const logger = createStorageBackedSecurityAuditLogger(storage);

    await logger.logSecurityEvent({
      source: "read_page",
      sessionId: "session-1",
      confidence: "high",
      matches: ["ignore-previous-instructions"],
    });

    const entries = await storage.get<SecurityAuditLogEntry[]>(SECURITY_AUDIT_LOG_KEY);
    expect(entries).toHaveLength(1);
    expect(entries?.[0]).toEqual(
      expect.objectContaining({
        source: "read_page",
        sessionId: "session-1",
        confidence: "high",
        matches: ["ignore-previous-instructions"],
      }),
    );
    expect(entries?.[0]).not.toHaveProperty("originalText");
    expect(entries?.[0].id).toEqual(expect.any(String));
    expect(entries?.[0].createdAt).toEqual(expect.any(Number));
  });

  it("keeps newest entries first and trims to the configured max", async () => {
    const storage = new InMemoryStorage();
    const logger = createStorageBackedSecurityAuditLogger(storage, { maxEntries: 2 });

    await logger.logSecurityEvent({
      source: "read_page",
      confidence: "low",
      matches: ["a"],
    });
    await logger.logSecurityEvent({
      source: "repl",
      confidence: "medium",
      matches: ["b"],
    });
    await logger.logSecurityEvent({
      source: "repl",
      confidence: "high",
      matches: ["c"],
    });

    const entries = await storage.get<SecurityAuditLogEntry[]>(SECURITY_AUDIT_LOG_KEY);
    expect(entries).toHaveLength(2);
    expect(entries?.map((entry) => entry.matches[0])).toEqual(["c", "b"]);
  });

  it("loads the newest audit entries up to the requested limit", async () => {
    const storage = new InMemoryStorage();

    await storage.set<SecurityAuditLogEntry[]>(SECURITY_AUDIT_LOG_KEY, [
      {
        id: "evt-3",
        createdAt: 3,
        source: "read_page",
        confidence: "high",
        matches: ["c"],
      },
      {
        id: "evt-2",
        createdAt: 2,
        source: "read_page",
        confidence: "medium",
        matches: ["b"],
      },
      {
        id: "evt-1",
        createdAt: 1,
        source: "read_page",
        confidence: "low",
        matches: ["a"],
      },
    ]);

    const entries = await loadSecurityAuditLog(storage, { limit: 2 });

    expect(entries.map((entry) => entry.id)).toEqual(["evt-3", "evt-2"]);
  });
});
