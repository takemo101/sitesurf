import { useState, useRef } from "react";
import { Box, Group, Text, ActionIcon, Paper, Badge } from "@mantine/core";
import { FileCode, ChevronDown, FileText, Trash, Edit, Plus, Eye } from "lucide-react";
import { CodeView } from "../artifacts/CodeView";
import { ScrollableResult } from "./tool-renderers/components";

interface ArtifactToolMessageProps {
  command?: "create" | "update" | "rewrite" | "get" | "delete" | "logs";
  filename?: string;
  content?: string;
  old_str?: string;
  new_str?: string;
  isStreaming?: boolean;
  result?: { content: string; isError?: boolean };
}

// Status colors
const STATUS_COLORS = {
  inprogress: { bg: "var(--mantine-color-blue-light)", border: "var(--mantine-color-blue-3)" },
  complete: { bg: "var(--mantine-color-green-light)", border: "var(--mantine-color-green-3)" },
  error: { bg: "var(--mantine-color-red-light)", border: "var(--mantine-color-red-3)" },
};

// Command icons mapping
const COMMAND_ICONS: Record<string, React.ReactNode> = {
  create: <Plus size={14} />,
  update: <Edit size={14} />,
  rewrite: <FileText size={14} />,
  get: <Eye size={14} />,
  delete: <Trash size={14} />,
  logs: <FileCode size={14} />,
};

export function ArtifactToolMessage({
  command,
  filename,
  content,
  old_str,
  new_str,
  isStreaming,
  result,
}: ArtifactToolMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!command) {
    return (
      <Paper
        p="xs"
        radius="sm"
        style={{
          background: STATUS_COLORS.inprogress.bg,
          border: `1px solid ${STATUS_COLORS.inprogress.border}`,
        }}
      >
        <Group gap="xs">
          <FileCode size={14} />
          <Text size="sm">Preparing artifact...</Text>
        </Group>
      </Paper>
    );
  }

  const isError = result?.isError;
  const isComplete = !isStreaming && result;
  const state = isError ? "error" : isComplete ? "complete" : "inprogress";
  const colors = STATUS_COLORS[state];

  const getStatusLabel = () => {
    const labels: Record<string, { streaming: string; complete: string }> = {
      create: { streaming: "Creating", complete: "Created" },
      update: { streaming: "Updating", complete: "Updated" },
      rewrite: { streaming: "Rewriting", complete: "Rewrote" },
      get: { streaming: "Reading", complete: "Read" },
      delete: { streaming: "Deleting", complete: "Deleted" },
      logs: { streaming: "Getting logs", complete: "Got logs" },
    };
    const label = labels[command] || { streaming: "Processing", complete: "Processed" };
    return isStreaming ? label.streaming : label.complete;
  };

  const showContent = ["create", "rewrite", "update", "get"].includes(command);
  const isDiff = command === "update" && old_str !== undefined && new_str !== undefined;

  // File extension for badge color
  const ext = filename?.split(".").pop()?.toLowerCase();
  const getExtColor = () => {
    const colors: Record<string, string> = {
      html: "cyan",
      js: "yellow",
      ts: "blue",
      json: "green",
      css: "pink",
      md: "gray",
    };
    return colors[ext || ""] || "gray";
  };

  return (
    <Paper
      radius="sm"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    >
      {/* Compact header */}
      <Group
        p="xs"
        justify="space-between"
        style={{
          cursor: showContent || isDiff ? "pointer" : "default",
        }}
        onClick={() => (showContent || isDiff) && setExpanded(!expanded)}
      >
        <Group gap="xs">
          {COMMAND_ICONS[command] || <FileCode size={14} />}
          <Text size="sm" fw={500}>
            {getStatusLabel()}
          </Text>
          {filename && (
            <Badge
              size="sm"
              variant="light"
              color={getExtColor()}
              style={{ fontFamily: "monospace", fontWeight: 600 }}
            >
              {filename}
            </Badge>
          )}
        </Group>

        {(showContent || isDiff) && (
          <ActionIcon
            variant="transparent"
            size="sm"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          >
            <ChevronDown size={16} />
          </ActionIcon>
        )}
      </Group>

      {/* Expandable content */}
      {expanded && (showContent || isDiff) && (
        <Box
          ref={contentRef}
          style={{
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <ScrollableResult maxHeight={500}>
            {isDiff ? (
              <DiffView oldStr={old_str || ""} newStr={new_str || ""} />
            ) : (
              <CodeView content={content || result?.content || ""} filename={filename} />
            )}
          </ScrollableResult>

          {isError && result?.content && (
            <Box p="sm" style={{ background: "var(--mantine-color-red-light)" }}>
              <Text size="sm" c="red">
                {result.content}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}

// Improved diff view
function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  return (
    <Box style={{ fontFamily: "monospace", fontSize: 12 }}>
      {/* Old content */}
      <Box
        p="xs"
        style={{
          background: "var(--mantine-color-red-light-hover)",
          borderLeft: "3px solid var(--mantine-color-red-5)",
        }}
      >
        <Text size="xs" c="red" fw={700} mb={4}>
          − REMOVED
        </Text>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            color: "var(--mantine-color-red-7)",
          }}
        >
          {oldStr}
        </pre>
      </Box>

      {/* New content */}
      <Box
        p="xs"
        style={{
          background: "var(--mantine-color-green-light-hover)",
          borderLeft: "3px solid var(--mantine-color-green-5)",
        }}
      >
        <Text size="xs" c="green" fw={700} mb={4}>
          + ADDED
        </Text>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            color: "var(--mantine-color-green-7)",
          }}
        >
          {newStr}
        </pre>
      </Box>
    </Box>
  );
}
