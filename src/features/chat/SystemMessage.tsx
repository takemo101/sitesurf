import { Text } from "@mantine/core";
import type { ChatMessage } from "@/ports/session-types";

export function SystemMessage({ msg }: { msg: ChatMessage }) {
  return (
    <Text size="xs" c="dimmed" ta="center" py={4} px="sm">
      {msg.content}
    </Text>
  );
}
