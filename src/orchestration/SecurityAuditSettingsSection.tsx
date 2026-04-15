import { Badge, Divider, Paper, Stack, Text } from "@mantine/core";
import type { SecurityAuditLogEntry } from "./security-audit";

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceColor(confidence: SecurityAuditLogEntry["confidence"]): string {
  switch (confidence) {
    case "high":
      return "red";
    case "medium":
      return "yellow";
    default:
      return "gray";
  }
}

export function SecurityAuditSettingsSection({
  entries,
  loading,
}: {
  entries: SecurityAuditLogEntry[];
  loading: boolean;
}) {
  return (
    <>
      <Divider label="Security Audit" labelPosition="center" />

      {loading ? (
        <Text size="xs" c="dimmed">
          監査ログを読み込み中...
        </Text>
      ) : entries.length === 0 ? (
        <Text size="xs" c="dimmed">
          まだ検知ログはありません
        </Text>
      ) : (
        <Stack gap="xs">
          {entries.map((entry) => (
            <Paper key={entry.id} withBorder p="xs" radius="sm">
              <Stack gap={4}>
                <Text size="10px" c="dimmed">
                  {formatTimestamp(entry.createdAt)} · {entry.source}
                </Text>
                <Badge
                  size="xs"
                  color={confidenceColor(entry.confidence)}
                  variant="light"
                  w="fit-content"
                >
                  {entry.confidence}
                </Badge>
                <Text size="xs">{entry.matches.join(", ")}</Text>
                <Text size="10px" c="dimmed">
                  session: {entry.sessionId ?? "unknown"}
                </Text>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  );
}
