import { Button, Group, Paper, Text } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import type { ChatMessage } from "@/ports/session-types";
import { useStore } from "@/store/index";

const AUTH_ERROR_CODES: ReadonlySet<string> = new Set([
  "ai_auth_invalid",
  "auth_expired",
  "auth_refresh_failed",
]);

export function ErrorMessage({ msg }: { msg: ChatMessage }) {
  const isAuthError = AUTH_ERROR_CODES.has(msg.errorCode ?? "");

  return (
    <Paper
      p="xs"
      radius="sm"
      withBorder
      bg="var(--mantine-color-red-light)"
      style={{ borderColor: "var(--mantine-color-red-outline)" }}
    >
      <Group gap={6} mb={4}>
        <AlertCircle size={12} color="var(--mantine-color-red-5)" />
        <Text size="10px" fw={600} tt="uppercase" c="red">
          エラー
        </Text>
      </Group>
      <Text size="xs" c="red">
        {msg.content}
      </Text>
      {isAuthError && (
        <Button
          variant="subtle"
          size="xs"
          mt={4}
          onClick={() => useStore.getState().setSettingsOpen(true)}
        >
          設定を開く
        </Button>
      )}
    </Paper>
  );
}
