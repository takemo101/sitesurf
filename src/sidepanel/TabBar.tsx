import { Group, Text } from "@mantine/core";
import { FileText } from "lucide-react";
import { useStore } from "@/store/index";

export function TabBar() {
  const title = useStore((s) => s.currentTab.title);
  const url = useStore((s) => s.currentTab.url);

  if (!url) return null;

  return (
    <Group
      gap={6}
      px="sm"
      py={4}
      wrap="nowrap"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
        flexShrink: 0,
        minHeight: 28,
      }}
    >
      <FileText size={12} style={{ flexShrink: 0 }} color="var(--mantine-color-dimmed)" />
      <Text size="xs" truncate c="dimmed" title={url}>
        {title || url}
      </Text>
      {title && (
        <Text size="xs" truncate c="dimmed" style={{ opacity: 0.6 }}>
          — {url}
        </Text>
      )}
    </Group>
  );
}
