import { ActionIcon, Badge, Group, Paper, Text } from "@mantine/core";
import { Trash2 } from "lucide-react";
import type { SessionMeta } from "@/ports/session-types";
import { formatRelativeDate } from "./format-relative-date";

interface SessionItemProps {
  meta: SessionMeta;
  isLocked: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function SessionItem({ meta, isLocked, isCurrent, onSelect, onDelete }: SessionItemProps) {
  return (
    <Paper
      p="sm"
      radius="sm"
      withBorder
      onClick={() => !isLocked && onSelect()}
      style={{
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.5 : 1,
        borderLeft: isCurrent ? "3px solid var(--mantine-color-indigo-5)" : undefined,
      }}
      className="hover-highlight"
    >
      <Group justify="space-between" mb={4}>
        <Group gap={6}>
          <Text size="sm" fw={600} truncate maw={220}>
            {meta.title}
          </Text>
          {isCurrent && (
            <Badge size="xs" color="indigo">
              現在
            </Badge>
          )}
          {isLocked && !isCurrent && (
            <Badge size="xs" color="red">
              🔒 ロック中
            </Badge>
          )}
        </Group>
        {!isLocked && !isCurrent && (
          <ActionIcon
            variant="subtle"
            size="xs"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="show-on-hover"
            aria-label={`${meta.title}を削除`}
          >
            <Trash2 size={12} />
          </ActionIcon>
        )}
      </Group>
      <Group gap="md" mb={4}>
        <Text size="xs" c="dimmed">
          {formatRelativeDate(meta.lastModified)}
        </Text>
        <Text size="xs" c="dimmed">
          {meta.messageCount} messages
        </Text>
      </Group>
      {meta.preview && (
        <Text size="xs" c="dimmed" lineClamp={2}>
          {meta.preview}
        </Text>
      )}
    </Paper>
  );
}
