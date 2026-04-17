import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Collapse,
  CopyButton,
  Group,
  Paper,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { motion } from "framer-motion";
import { Bot, Brain, Check, ChevronDown, ChevronRight, Copy, Wrench, User } from "lucide-react";
import type { ChatMessage, ToolCallInfo } from "@/ports/session-types";
import { useStore } from "@/store/index";
import { messageStyles, type StyledRole } from "./theme";
import { MarkdownContent } from "./MarkdownContent";
import { ToolCallBlock } from "./ToolCallBlock";
import { ImageLightbox } from "./tool-renderers/components";

const roleConfig = {
  user: { icon: User, label: "You" },
  assistant: { icon: Bot, label: "Assistant" },
} as const;

function ReasoningBlock({ text, isThinking }: { text: string; isThinking?: boolean }) {
  const [opened, { toggle }] = useDisclosure(false);
  return (
    <Paper p={4} mb={4} radius="sm" bg="var(--mantine-color-default-hover)">
      <UnstyledButton onClick={toggle} w="100%">
        <Group gap={4}>
          <Brain size={12} />
          {opened ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Text size="xs" c="dimmed" fw={500}>
            {isThinking ? "思考中..." : "思考内容"}
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse expanded={opened}>
        <Text size="xs" c="dimmed" mt={4} style={{ whiteSpace: "pre-wrap" }}>
          {text}
        </Text>
      </Collapse>
    </Paper>
  );
}

function ToolCallGroup({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  const hasRunning = toolCalls.some((tc) => tc.isRunning);
  const allSuccess = toolCalls.every((tc) => tc.success === true);
  const hasError = toolCalls.some((tc) => tc.success === false);
  const [expanded, setExpanded] = useState(hasRunning || toolCalls.length <= 2);

  // If only 1-2 tools, show inline without grouping
  if (toolCalls.length <= 2) {
    return (
      <>
        {toolCalls.map((tc) => (
          <ToolCallBlock key={tc.id} tc={tc} />
        ))}
      </>
    );
  }

  return (
    <Box mt={8}>
      <UnstyledButton
        onClick={() => setExpanded((prev) => !prev)}
        py={4}
        px={6}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 4,
        }}
        className="hover-highlight"
      >
        <Wrench size={12} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed" fw={500}>
          ツール実行
        </Text>
        <Badge
          size="xs"
          variant="light"
          color={hasRunning ? "indigo" : hasError ? "red" : allSuccess ? "green" : "gray"}
        >
          {toolCalls.length}
        </Badge>
        <ChevronDown
          size={12}
          color="var(--mantine-color-dimmed)"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </UnstyledButton>

      <Collapse expanded={expanded}>
        {toolCalls.map((tc) => (
          <ToolCallBlock key={tc.id} tc={tc} />
        ))}
      </Collapse>
    </Box>
  );
}

export function ChatBubble({ msg, isLast }: { msg: ChatMessage; isLast?: boolean }) {
  const role = msg.role as StyledRole;
  const config = roleConfig[role as keyof typeof roleConfig];
  const style = messageStyles[role];
  const Icon = config.icon;
  const isStreaming = useStore((s) => s.isStreaming);
  const isAssistant = role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Paper
        p="sm"
        radius="sm"
        withBorder={role !== "assistant"}
        bg={style.bg}
        style={{
          borderColor: style.borderColor,
        }}
      >
        <Group gap={6} mb={4} justify="space-between">
          <Group gap={6}>
            <Icon size={12} />
            <Text size="10px" fw={600} tt="uppercase" c="dimmed">
              {config.label}
            </Text>
          </Group>
          {isAssistant && msg.content && (
            <CopyButton value={msg.content}>
              {({ copied, copy }) => (
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  onClick={copy}
                  aria-label={copied ? "コピー済み" : "マークダウンをコピー"}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </ActionIcon>
              )}
            </CopyButton>
          )}
        </Group>

        {msg.reasoning && (
          <ReasoningBlock
            text={msg.reasoning}
            isThinking={isLast === true && isStreaming && !msg.content}
          />
        )}

        <MarkdownContent content={msg.content} />

        {msg.image && (
          <Paper mt={4} radius="sm" withBorder style={{ maxWidth: 300, overflow: "hidden" }}>
            <ImageLightbox src={msg.image} alt="Screenshot" />
          </Paper>
        )}

        {msg.toolCalls && msg.toolCalls.length > 0 && <ToolCallGroup toolCalls={msg.toolCalls} />}
      </Paper>
    </motion.div>
  );
}
