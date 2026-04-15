import { Stack, Text } from "@mantine/core";
import { MessageSquare } from "lucide-react";

export function EmptyState() {
  return (
    <Stack align="center" py="xl" gap="sm">
      <MessageSquare size={32} color="var(--mantine-color-dimmed)" />
      <Text size="sm" c="dimmed">
        セッションがまだありません
      </Text>
    </Stack>
  );
}
