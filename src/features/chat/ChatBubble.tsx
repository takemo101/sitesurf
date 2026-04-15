import {
  ActionIcon,
  Collapse,
  CopyButton,
  Group,
  Image,
  Paper,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { motion } from "framer-motion";
import { Bot, Brain, Check, ChevronDown, ChevronRight, Copy, User } from "lucide-react";
import type { ChatMessage } from "@/ports/session-types";
import { useStore } from "@/store/index";
import { messageStyles, type StyledRole } from "./theme";
import { MarkdownContent } from "./MarkdownContent";
import { ToolCallBlock } from "./ToolCallBlock";

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
          <Image
            src={msg.image}
            radius="sm"
            mt={4}
            maw={300}
            style={{ border: "1px solid var(--mantine-color-default-border)" }}
          />
        )}

        {msg.toolCalls?.map((tc) => (
          <ToolCallBlock key={tc.id} tc={tc} />
        ))}
      </Paper>
    </motion.div>
  );
}
