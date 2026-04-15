import { Group, Text } from "@mantine/core";

export function StreamingIndicator() {
  return (
    <Group gap={8} px="sm" py={6}>
      <div className="surf-thinking-wave" aria-hidden="true">
        <span className="surf-thinking-wave-dot" />
        <span className="surf-thinking-wave-dot" />
        <span className="surf-thinking-wave-dot" />
        <span className="surf-thinking-wave-dot" />
      </div>
      <Text size="xs" c="dimmed">
        考え中...
      </Text>
    </Group>
  );
}
