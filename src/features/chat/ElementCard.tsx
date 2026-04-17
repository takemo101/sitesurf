import { useState } from "react";
import { ActionIcon, Code, Collapse, Group, Paper, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown, ChevronUp, MousePointer2, X } from "lucide-react";
import { ScrollableResult } from "./tool-renderers/components";
import type { ElementInfo } from "@/ports/browser-executor";

export function ElementCard({
  element,
  onDismiss,
}: {
  element: ElementInfo;
  onDismiss: () => void;
}) {
  const [showDOM, setShowDOM] = useState(false);

  return (
    <Paper
      p="xs"
      mx="xs"
      mt={6}
      radius="sm"
      withBorder
      style={{ borderColor: "var(--mantine-color-indigo-outline)" }}
    >
      <Group justify="space-between" mb={2}>
        <Group gap={6}>
          <MousePointer2 size={12} color="var(--mantine-color-indigo-5)" />
          <Text size="xs" fw={600}>
            {"<"}
            {element.tagName}
            {">"}
          </Text>
          <Text size="xs" c="dimmed" truncate maw={200}>
            {element.text?.substring(0, 50) || "(テキストなし)"}
          </Text>
        </Group>
        <ActionIcon variant="subtle" size="xs" onClick={onDismiss} aria-label="要素選択を解除">
          <X size={10} />
        </ActionIcon>
      </Group>

      <Code style={{ fontSize: 10 }}>{element.selector}</Code>

      {element.surroundingHTML && (
        <>
          <UnstyledButton onClick={() => setShowDOM(!showDOM)} mt={4}>
            <Group gap={4}>
              {showDOM ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              <Text size="xs" c="dimmed">
                周辺DOM
              </Text>
            </Group>
          </UnstyledButton>
          <Collapse expanded={showDOM}>
            <ScrollableResult maxHeight={120}>
              <Code block style={{ fontSize: 12 }} mt={4}>
                {element.surroundingHTML}
              </Code>
            </ScrollableResult>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
