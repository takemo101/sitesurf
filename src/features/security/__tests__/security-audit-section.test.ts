import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { SecurityAuditSettingsSection } from "@/orchestration/SecurityAuditSettingsSection";
import type { SecurityAuditLogEntry } from "@/orchestration/security-audit";

function makeEntry(overrides: Partial<SecurityAuditLogEntry> = {}): SecurityAuditLogEntry {
  return {
    id: "evt-1",
    createdAt: 1_700_000_000_000,
    source: "read_page",
    sessionId: "session-1",
    confidence: "high",
    matches: ["ignore-previous-instructions", "exfiltrate-data"],
    ...overrides,
  };
}

function renderSection(entries: SecurityAuditLogEntry[], loading: boolean): string {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      {},
      createElement(SecurityAuditSettingsSection, { entries, loading }),
    ),
  );
}

describe("SecurityAuditSettingsSection", () => {
  it("renders empty state when no entries exist", () => {
    const html = renderSection([], false);

    expect(html).toContain("Security Audit");
    expect(html).toContain("まだ検知ログはありません");
  });

  it("renders audit entry summary", () => {
    const html = renderSection([makeEntry()], false);

    expect(html).toContain("read_page");
    expect(html).toContain("high");
    expect(html).toContain("ignore-previous-instructions");
    expect(html).not.toContain("Ignore previous instructions");
  });
});
