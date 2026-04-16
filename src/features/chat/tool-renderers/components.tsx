import { useEffect, useState, type ReactNode } from "react";
import {
  ActionIcon,
  Box,
  Code,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode,
  Image as ImageIcon,
  Terminal,
  X,
  Zap,
  XCircle,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import type { ToolCallInfo } from "@/ports/session-types";
import { normalizeConsoleLogEntry, type ConsoleLogEntry } from "../services/console-log";
import type { ToolRenderer, ToolRendererContext } from "./types";

interface UsedSkillInfo {
  skillId: string;
  skillName: string;
  extractorIds: string[];
}

interface ToolMessageContainerProps {
  toolCall: ToolCallInfo;
  description?: string | null;
  summary?: ReactNode;
  icon?: ReactNode;
  defaultExpanded?: boolean;
  children?: ReactNode;
}

function StatusIcon({ toolCall }: { toolCall: ToolCallInfo }) {
  if (toolCall.isRunning) {
    return <Loader size={14} type="dots" color="var(--mantine-color-indigo-5)" />;
  }

  if (toolCall.success === true) {
    return <CheckCircle size={16} color="var(--mantine-color-green-5)" />;
  }

  if (toolCall.success !== false) {
    return (
      <Text size="sm" c="dimmed" aria-label="status-pending">
        •
      </Text>
    );
  }

  return <XCircle size={16} color="var(--mantine-color-red-5)" />;
}

export function ToolMessageContainer({
  toolCall,
  description,
  summary,
  icon,
  defaultExpanded,
  children,
}: ToolMessageContainerProps) {
  const [expanded, setExpanded] = useState(toolCall.isRunning || defaultExpanded === true);

  useEffect(() => {
    if (toolCall.isRunning) {
      setExpanded(true);
    }
  }, [toolCall.isRunning]);

  return (
    <Paper
      mt="sm"
      radius="md"
      withBorder
      style={{
        borderColor: toolCall.isRunning
          ? "var(--mantine-color-indigo-3)"
          : "var(--mantine-color-default-border)",
        boxShadow: toolCall.isRunning ? "0 0 0 1px var(--mantine-color-indigo-light)" : undefined,
      }}
    >
      <UnstyledButton
        onClick={() => !toolCall.isRunning && setExpanded((prev) => !prev)}
        w="100%"
        px="md"
        py="sm"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
        aria-label={`ツール: ${toolCall.name}`}
        aria-expanded={expanded}
      >
        {icon ?? <Terminal size={18} color="var(--mantine-color-indigo-5)" />}
        <Text size="sm" fw={600} c="indigo">
          {toolCall.name}
        </Text>
        {summary ? (
          <Box style={{ flex: 1 }}>{summary}</Box>
        ) : description ? (
          <Text size="sm" c="dimmed" truncate style={{ flex: 1 }}>
            {description}
          </Text>
        ) : null}
        <StatusIcon toolCall={toolCall} />
        {!toolCall.isRunning && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
      </UnstyledButton>

      {expanded && (
        <Box px="md" pb="md">
          {children}
        </Box>
      )}
    </Paper>
  );
}

interface ReplResultPayload {
  output?: string;
  returnValue?: unknown;
  files?: Array<{ name?: string; mimeType?: string; size?: number }>;
  usedSkills?: UsedSkillInfo[];
}

interface ExtractImageInfo {
  selector?: string;
  originalWidth?: number;
  originalHeight?: number;
  resizedWidth?: number;
  resizedHeight?: number;
}

interface ParsedExtractImageResult {
  imageUrl: string | null;
  info: ExtractImageInfo;
  errorText: string | null;
}

interface ParsedArtifactResult {
  content?: string;
  isError?: boolean;
}

function parseReplResult(result?: string): ReplResultPayload | null {
  if (!result) return null;

  try {
    return JSON.parse(result) as ReplResultPayload;
  } catch {
    return null;
  }
}

function extractImageUrl(result?: string): string | null {
  if (!result) return null;
  if (result.startsWith("data:image/")) return result;

  try {
    const parsed = JSON.parse(result);
    if (parsed?.image?.source?.base64 && parsed?.image?.source?.media_type) {
      return `data:${parsed.image.source.media_type};base64,${parsed.image.source.base64}`;
    }

    if (typeof parsed?.dataUrl === "string" && parsed.dataUrl.startsWith("data:image/")) {
      return parsed.dataUrl;
    }
  } catch {
    return null;
  }

  return null;
}

function parseExtractImageResult(result?: string): ParsedExtractImageResult {
  if (!result) {
    return { imageUrl: null, info: {}, errorText: null };
  }

  const imageUrl = extractImageUrl(result);

  try {
    const parsed = JSON.parse(result);
    return {
      imageUrl,
      info: typeof parsed?.info === "object" && parsed.info !== null ? parsed.info : {},
      errorText:
        typeof parsed?.error?.message === "string"
          ? parsed.error.message
          : typeof parsed?.message === "string"
            ? parsed.message
            : null,
    };
  } catch {
    return { imageUrl, info: {}, errorText: null };
  }
}

function parseArtifactResult(result?: string): ParsedArtifactResult {
  if (!result) return {};
  try {
    return JSON.parse(result) as ParsedArtifactResult;
  } catch {
    return { content: result };
  }
}

async function downloadImageResource(imageUrl: string, filename: string): Promise<void> {
  const chromeDownloads = (globalThis as { chrome?: typeof chrome }).chrome?.downloads;
  const download = chromeDownloads?.download?.bind(chromeDownloads);

  if (download) {
    const downloadId = await download({ url: imageUrl, filename, saveAs: false });
    if (downloadId === undefined) {
      throw new Error("ダウンロード開始に失敗しました");
    }
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("ダウンロードAPIが利用できません");
  }

  const anchor = document.createElement("a");
  anchor.href = imageUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function extractStreamingContent(inputDelta?: string): string {
  if (!inputDelta) return "";

  const match = inputDelta.match(/"content":"((?:[^"\\]|\\.)*)/);
  if (!match) return inputDelta;

  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"');
}

function JsonValue({ value }: { value: unknown }) {
  return (
    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ImageLightbox({ src, alt }: { src: string; alt?: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <UnstyledButton onClick={() => setOpened(true)} style={{ cursor: "zoom-in", display: "block" }}>
        <Image src={src} alt={alt ?? "Image"} style={{ maxWidth: "100%", height: "auto" }} />
      </UnstyledButton>
      {opened && (
        <Modal
          opened
          onClose={() => setOpened(false)}
          fullScreen
          withCloseButton={false}
          styles={{
            body: {
              padding: 0,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0, 0, 0, 0.9)",
            },
            content: { background: "transparent", boxShadow: "none" },
          }}
        >
          <ActionIcon
            variant="filled"
            color="dark"
            size="lg"
            radius="xl"
            onClick={() => setOpened(false)}
            aria-label="閉じる"
            style={{ position: "fixed", top: 16, right: 16, zIndex: 1 }}
          >
            <X size={24} />
          </ActionIcon>
          <UnstyledButton
            onClick={() => setOpened(false)}
            style={{ cursor: "zoom-out", maxWidth: "95vw", maxHeight: "95vh" }}
          >
            <img
              src={src}
              alt={alt ?? "Image"}
              style={{ maxWidth: "95vw", maxHeight: "95vh", objectFit: "contain" }}
            />
          </UnstyledButton>
        </Modal>
      )}
    </>
  );
}

function syncConsoleLogsFromOutput(
  consoleLogService: ToolRendererContext["consoleLogService"],
  toolCallId: string,
  output?: string,
): void {
  if (!output) return;
  if (consoleLogService.get(toolCallId).length > 0) return;

  for (const line of output
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const normalized = normalizeConsoleLogEntry(line);
    consoleLogService.append(toolCallId, {
      level: normalized.level,
      message: normalized.message,
      timestamp: normalized.timestamp,
    });
  }
}

function ReplRendererView({ toolCall, consoleLogService }: ToolRendererContext) {
  const parsed = parseReplResult(toolCall.result);
  const code = typeof toolCall.args.code === "string" ? toolCall.args.code : null;
  const [copied, setCopied] = useState(false);
  const [logEntries, setLogEntries] = useState<ConsoleLogEntry[]>(() =>
    consoleLogService.get(toolCall.id),
  );

  useEffect(() => {
    return consoleLogService.subscribe(toolCall.id, setLogEntries);
  }, [consoleLogService, toolCall.id]);

  useEffect(() => {
    syncConsoleLogsFromOutput(consoleLogService, toolCall.id, parsed?.output);
  }, [consoleLogService, parsed?.output, toolCall.id]);

  if (toolCall.isRunning) {
    return (
      <Box p="md" style={{ background: "var(--mantine-color-default-hover)", borderRadius: 4 }}>
        <Group gap="xs" mb={logEntries.length > 0 ? "xs" : 0}>
          <Loader size={14} />
          <Text size="sm" c="dimmed">
            Running REPL...
          </Text>
        </Group>
        {logEntries.map((entry) => (
          <Text
            key={entry.id}
            size="xs"
            style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
          >
            {entry.message}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box mt="xs">
      {parsed?.usedSkills && parsed.usedSkills.length > 0 && (
        <Paper
          p="xs"
          radius="md"
          mb="xs"
          style={{
            background: "var(--mantine-color-violet-light)",
            border: "1px solid var(--mantine-color-violet-light)",
          }}
        >
          <Group gap={6}>
            <Zap size={14} color="var(--mantine-color-violet-5)" />
            {parsed.usedSkills.map((skill) => (
              <Text key={skill.skillId} size="xs" fw={600} c="violet">
                {skill.skillName}
                {skill.extractorIds.length > 0 && (
                  <Text span size="xs" c="dimmed" fw={400}>
                    {" "}
                    / {skill.extractorIds.join(", ")}
                  </Text>
                )}
              </Text>
            ))}
          </Group>
        </Paper>
      )}

      {code && (
        <Paper withBorder radius="md" p="sm" mb="xs">
          <Group justify="space-between" mb={6}>
            <Text size="xs" fw={700} c="dimmed">
              JavaScript
            </Text>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label="Copy code"
              onClick={async () => {
                if (typeof navigator === "undefined") return;
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                } catch {}
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </ActionIcon>
          </Group>
          <Code block>{code}</Code>
        </Paper>
      )}

      {logEntries.length > 0 && (
        <Paper withBorder p="sm" radius="md" mb="xs">
          <Text size="xs" fw={700} mb={6}>
            Console / Output
          </Text>
          {logEntries.map((entry) => (
            <Text
              key={entry.id}
              size="xs"
              style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
            >
              {entry.message}
            </Text>
          ))}
        </Paper>
      )}

      {parsed && "returnValue" in parsed && (
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" fw={700} mb={6}>
            Return Value
          </Text>
          <JsonValue value={parsed.returnValue} />
        </Paper>
      )}

      {parsed?.files && parsed.files.length > 0 && (
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" fw={700} mb={6}>
            Files
          </Text>
          {parsed.files.map((file, index) => (
            <Text key={`${file.name ?? "file"}-${index}`} size="xs" c="dimmed">
              {file.name ?? "(unnamed)"}
              {file.mimeType ? ` · ${file.mimeType}` : ""}
              {typeof file.size === "number" ? ` · ${file.size} bytes` : ""}
            </Text>
          ))}
        </Paper>
      )}

      {!parsed && toolCall.result && (
        <Text size="xs" c={toolCall.success ? "green" : "red"} style={{ whiteSpace: "pre-wrap" }}>
          {toolCall.result}
        </Text>
      )}
    </Box>
  );
}

function ExtractImageRendererView({ toolCall }: ToolRendererContext) {
  const { imageUrl, info, errorText } = parseExtractImageResult(toolCall.result);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (toolCall.isRunning) {
    return (
      <Box p="md" style={{ background: "var(--mantine-color-default-hover)", borderRadius: 4 }}>
        <Group gap="xs">
          <Loader size={14} />
          <Text size="sm" c="dimmed">
            Extracting image...
          </Text>
        </Group>
      </Box>
    );
  }

  if (!imageUrl) {
    return (
      <Box p="md" style={{ background: "var(--mantine-color-red-light-hover)", borderRadius: 4 }}>
        <Group gap="xs">
          <XCircle size={16} color="var(--mantine-color-red-5)" />
          <Box>
            <Text size="sm" c="red">
              Failed to extract image
            </Text>
            {errorText && (
              <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                {errorText}
              </Text>
            )}
          </Box>
        </Group>
      </Box>
    );
  }

  return (
    <Box mt="xs">
      <Paper
        p="sm"
        radius="md"
        style={{
          background: "var(--mantine-color-green-light)",
          border: "1px solid var(--mantine-color-green-light)",
        }}
      >
        <Group gap="sm">
          <ImageIcon size={20} color="var(--mantine-color-green-5)" />
          <Box>
            <Text size="sm" fw={600}>
              Image extracted
            </Text>
            {info.selector && (
              <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                {info.selector}
              </Text>
            )}
          </Box>
        </Group>
      </Paper>

      <Paper
        withBorder
        radius="md"
        mt="xs"
        style={{ overflow: "hidden", maxWidth: "100%", position: "relative" }}
      >
        <ImageLightbox src={imageUrl} alt="Extracted image" />

        <ActionIcon
          variant="filled"
          color="dark"
          size="md"
          radius="xl"
          title="画像をダウンロード"
          aria-label="画像をダウンロード"
          loading={isDownloading}
          onClick={async (e) => {
            e.stopPropagation();
            const mediaTypeMatch = imageUrl.match(/^data:image\/([^;]+);/);
            const mediaType = mediaTypeMatch?.[1]?.toLowerCase();
            const extension = mediaType === "jpeg" ? "jpg" : mediaType || "png";
            const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
            const filename = `sitesurf-extract-${timestamp}.${extension}`;

            try {
              setIsDownloading(true);
              setDownloadError(null);
              await downloadImageResource(imageUrl, filename);
              notifications.show({
                title: "ダウンロード開始",
                message: `保存を開始しました: ${filename}`,
                color: "green",
              });
            } catch (error) {
              setDownloadError(
                error instanceof Error ? error.message : "ダウンロードに失敗しました",
              );
            } finally {
              setIsDownloading(false);
            }
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backdropFilter: "blur(4px)",
            background: "rgba(0, 0, 0, 0.55)",
          }}
        >
          <Download size={16} />
        </ActionIcon>
      </Paper>

      {(info.originalWidth || info.resizedWidth) && (
        <Text size="xs" c="dimmed" mt="xs">
          {info.originalWidth &&
            info.originalHeight &&
            `${info.originalWidth}x${info.originalHeight}`}
          {info.resizedWidth &&
            info.resizedHeight &&
            ` → ${info.resizedWidth}x${info.resizedHeight}`}
        </Text>
      )}

      {downloadError && (
        <Text size="xs" c="red" mt={4} style={{ whiteSpace: "pre-wrap" }}>
          {downloadError}
        </Text>
      )}
    </Box>
  );
}

function ArtifactsRendererView({ toolCall }: ToolRendererContext) {
  const args = toolCall.args;
  const command = typeof args.command === "string" ? args.command : undefined;
  const filename = typeof args.filename === "string" ? args.filename : "file";
  const contentArg = typeof args.content === "string" ? args.content : undefined;
  const oldStr = typeof args.old_str === "string" ? args.old_str : undefined;
  const newStr = typeof args.new_str === "string" ? args.new_str : undefined;
  const isHtml = filename.endsWith(".html") || filename.endsWith(".htm");
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");

  if (!command) {
    if (toolCall.isRunning) {
      return (
        <Box p="md" style={{ background: "var(--mantine-color-default-hover)", borderRadius: 4 }}>
          <Group gap="xs">
            <Loader size={14} />
            <Text size="sm" c="dimmed">
              Preparing artifact...
            </Text>
          </Group>
        </Box>
      );
    }

    return (
      <Box p="md" style={{ background: "var(--mantine-color-default-hover)", borderRadius: 4 }}>
        <Group gap="xs">
          <XCircle size={14} color="var(--mantine-color-red-5)" />
          <Text size="sm" c="red">
            Error: Missing command. Please specify create, update, rewrite, get, or delete.
          </Text>
        </Group>
      </Box>
    );
  }

  const streamingContent = extractStreamingContent(toolCall.inputDelta);
  const result = parseArtifactResult(toolCall.result);

  if (toolCall.isRunning) {
    return (
      <Box mt="xs">
        <Paper
          p="sm"
          radius="md"
          style={{
            background: "var(--mantine-color-indigo-light)",
            border: "1px solid var(--mantine-color-indigo-light)",
          }}
        >
          <Group gap="sm">
            <FileCode size={20} color="var(--mantine-color-indigo-5)" />
            <Text size="sm" fw={600}>
              {command === "create" ? `Creating ${filename}...` : `Processing ${filename}...`}
            </Text>
          </Group>
        </Paper>

        {streamingContent && (
          <Paper withBorder radius="md" p="sm" mt="xs">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <code>{streamingContent}</code>
            </pre>
          </Paper>
        )}
      </Box>
    );
  }

  const content = contentArg ?? result.content ?? "";
  const showDiff = command === "update" && oldStr !== undefined && newStr !== undefined;
  const showContent = Boolean(content) && result.isError !== true && command !== "delete";
  const canPreviewHtml = isHtml && contentArg !== undefined;

  const getStatusText = () => {
    switch (command) {
      case "create":
        return `Created ${filename}`;
      case "rewrite":
        return `Rewrote ${filename}`;
      case "update":
        return `Updated ${filename}`;
      case "get":
        return `Read ${filename}`;
      case "delete":
        return `Deleted ${filename}`;
      default:
        return `Processed ${filename}`;
    }
  };

  return (
    <Box mt="xs">
      <Paper
        p="sm"
        radius="md"
        style={{
          background:
            toolCall.success === false
              ? "var(--mantine-color-red-light)"
              : "var(--mantine-color-green-light)",
          border: `1px solid ${
            toolCall.success === false
              ? "var(--mantine-color-red-light)"
              : "var(--mantine-color-green-light)"
          }`,
        }}
      >
        <Group justify="space-between">
          <Group gap="sm">
            <FileCode
              size={20}
              color={
                toolCall.success === false
                  ? "var(--mantine-color-red-5)"
                  : "var(--mantine-color-green-5)"
              }
            />
            <Text size="sm" fw={600}>
              {getStatusText()}
            </Text>
          </Group>

          {canPreviewHtml && showContent && (
            <Group gap={4}>
              <ActionIcon
                variant={viewMode === "code" ? "filled" : "light"}
                size="sm"
                color="gray"
                onClick={() => setViewMode("code")}
              >
                <Code2 size={14} />
              </ActionIcon>
              <ActionIcon
                variant={viewMode === "preview" ? "filled" : "light"}
                size="sm"
                color="gray"
                onClick={() => setViewMode("preview")}
              >
                <Eye size={14} />
              </ActionIcon>
            </Group>
          )}
        </Group>
      </Paper>

      <Box mt="xs">
        {showDiff ? (
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Box
              p="md"
              style={{
                background: "var(--mantine-color-red-light-hover)",
                borderBottom: "1px solid var(--mantine-color-default-border)",
              }}
            >
              <Text size="xs" fw={700} c="red" mb="xs">
                − OLD
              </Text>
              <Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                {oldStr}
              </Code>
            </Box>
            <Box p="md" style={{ background: "var(--mantine-color-green-light-hover)" }}>
              <Text size="xs" fw={700} c="green" mb="xs">
                + NEW
              </Text>
              <Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                {newStr}
              </Code>
            </Box>
          </Paper>
        ) : viewMode === "preview" && canPreviewHtml ? (
          <Paper withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
            <Box style={{ height: 300, background: "white" }}>
              <iframe
                srcDoc={content}
                style={{ width: "100%", height: "100%", border: "none" }}
                sandbox=""
                title={filename}
              />
            </Box>
          </Paper>
        ) : showContent ? (
          <Paper withBorder radius="md" p="sm">
            <Code block>{content}</Code>
          </Paper>
        ) : null}

        {result.isError && result.content && (
          <Paper mt="xs" p="md" radius="md" bg="red" c="white">
            <Text size="sm">{result.content}</Text>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

function createSummaryRenderer(
  render: (toolCall: ToolCallInfo) => ReactNode,
): ToolRenderer["renderSummary"] {
  return ({ toolCall }) => render(toolCall);
}

export const replToolRenderer: ToolRenderer = {
  renderExecuting: (context) => <ReplRendererView {...context} />,
  renderSuccess: (context) => <ReplRendererView {...context} />,
  renderError: (context) => <ReplRendererView {...context} />,
  renderSummary: createSummaryRenderer((toolCall) => {
    const title = typeof toolCall.args.title === "string" ? toolCall.args.title : toolCall.name;
    return <Text size="sm">{title}</Text>;
  }),
};

export const extractImageToolRenderer: ToolRenderer = {
  renderExecuting: (context) => <ExtractImageRendererView {...context} />,
  renderSuccess: (context) => <ExtractImageRendererView {...context} />,
  renderError: (context) => <ExtractImageRendererView {...context} />,
  renderSummary: createSummaryRenderer((toolCall) => {
    const selector =
      typeof toolCall.args.selector === "string" ? toolCall.args.selector : toolCall.name;
    return <Text size="sm">{selector}</Text>;
  }),
};

export const artifactsToolRenderer: ToolRenderer = {
  renderExecuting: (context) => <ArtifactsRendererView {...context} />,
  renderSuccess: (context) => <ArtifactsRendererView {...context} />,
  renderError: (context) => <ArtifactsRendererView {...context} />,
  renderSummary: createSummaryRenderer((toolCall) => {
    const filename =
      typeof toolCall.args.filename === "string" ? toolCall.args.filename : toolCall.name;
    return <Text size="sm">{filename}</Text>;
  }),
};
