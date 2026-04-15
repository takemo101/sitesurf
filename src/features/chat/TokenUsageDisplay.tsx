import { Group, Text, Tooltip } from "@mantine/core";
import { useStore } from "@/store";

export function TokenUsageDisplay() {
  const messages = useStore((s) => s.messages);

  // Calculate total tokens from all assistant messages with usage
  const totalTokens = messages.reduce((sum, msg) => {
    if (msg.role === "assistant" && msg.usage) {
      return sum + msg.usage.totalTokens;
    }
    return sum;
  }, 0);

  const lastUsage = messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.usage)?.usage;

  if (totalTokens === 0) return null;

  return (
    <Tooltip
      label={
        lastUsage
          ? `入力: ${lastUsage.promptTokens.toLocaleString()} / 出力: ${lastUsage.completionTokens.toLocaleString()}`
          : "トークン使用量"
      }
    >
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          トークン: {totalTokens.toLocaleString()}
        </Text>
      </Group>
    </Tooltip>
  );
}
