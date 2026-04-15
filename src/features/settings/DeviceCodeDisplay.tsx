import { ActionIcon, CopyButton, Group, Paper, Text, Tooltip } from "@mantine/core";
import { Check, Copy } from "lucide-react";

import type { DeviceCodeInfo } from "@/ports/auth-provider";

interface DeviceCodeDisplayProps {
  deviceCode: DeviceCodeInfo;
}

export function DeviceCodeDisplay({ deviceCode }: DeviceCodeDisplayProps) {
  return (
    <Paper p="sm" radius="sm" withBorder ta="center">
      <Text size="xs" c="dimmed" mb={4}>
        以下のコードをブラウザで入力:
      </Text>
      <Group justify="center" gap={6}>
        <Text size="xl" fw={700} c="indigo" style={{ fontFamily: "monospace", letterSpacing: 3 }}>
          {deviceCode.userCode}
        </Text>
        <CopyButton value={deviceCode.userCode}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "コピーしました" : "コピー"}>
              <ActionIcon
                variant="subtle"
                size="sm"
                color={copied ? "green" : "gray"}
                onClick={copy}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        コードの有効期限: {Math.floor(deviceCode.expiresIn / 60)}分
      </Text>
    </Paper>
  );
}
