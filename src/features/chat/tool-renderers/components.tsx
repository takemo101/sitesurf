import { useEffect, useRef, useState, type ReactNode } from "react";
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
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode,
  Image as ImageIcon,
  MousePointerClick,
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
  const isComplete = !toolCall.isRunning && toolCall.success !== undefined;
  const [expanded, setExpanded] = useState(
    toolCall.isRunning || (defaultExpanded === true && !isComplete),
  );

  // 実行中は自動展開 → 完了した瞬間に自動で畳む。ユーザが完了後に手動で
  // 展開した状態は、次の running → complete 遷移まで維持する。
  const wasRunningRef = useRef(toolCall.isRunning);
  useEffect(() => {
    if (toolCall.isRunning) {
      setExpanded(true);
      wasRunningRef.current = true;
      return;
    }
    if (wasRunningRef.current) {
      setExpanded(false);
      wasRunningRef.current = false;
    }
  }, [toolCall.isRunning]);

  const borderLeftColor = toolCall.isRunning
    ? "var(--mantine-color-indigo-5)"
    : toolCall.success === true
      ? "var(--mantine-color-green-5)"
      : toolCall.success === false
        ? "var(--mantine-color-red-5)"
        : "var(--mantine-color-default-border)";

  return (
    <Box
      mt={6}
      className={toolCall.isRunning ? "tool-running" : undefined}
      style={{
        borderLeft: `3px solid ${borderLeftColor}`,
        borderRadius: 4,
        background: toolCall.isRunning
          ? "var(--mantine-color-indigo-light)"
          : expanded
            ? "var(--mantine-color-default-hover)"
            : "transparent",
        transition: "background 0.15s ease",
      }}
    >
      <UnstyledButton
        onClick={() => !toolCall.isRunning && setExpanded((prev) => !prev)}
        w="100%"
        px="sm"
        py={6}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
        aria-label={`ツール: ${toolCall.name}`}
        aria-expanded={expanded}
      >
        {icon ?? <Terminal size={14} color="var(--mantine-color-indigo-5)" />}
        <Text size="xs" fw={600} c={toolCall.isRunning ? "indigo" : "dimmed"}>
          {toolCall.name}
        </Text>
        {summary ? (
          <Box style={{ flex: 1 }}>{summary}</Box>
        ) : description ? (
          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
            {description}
          </Text>
        ) : (
          <Box style={{ flex: 1 }} />
        )}
        <StatusIcon toolCall={toolCall} />
        {!toolCall.isRunning && (
          <ChevronDown
            size={12}
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              opacity: 0.5,
            }}
          />
        )}
      </UnstyledButton>

      {expanded && (
        <Box px="sm" pb="sm">
          {children}
        </Box>
      )}
    </Box>
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

export function ScrollableResult({
  children,
  maxHeight = 200,
}: {
  children: ReactNode;
  maxHeight?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollHeight > el.clientHeight + 4);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hide fade when scrolled to bottom
  const handleScroll = () => {
    const el = innerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setHasOverflow(!atBottom && el.scrollHeight > el.clientHeight + 4);
  };

  return (
    <div className="scrollable-result">
      <div
        ref={innerRef}
        className={`scrollable-result-inner${hasOverflow ? " has-overflow" : ""}`}
        style={{ maxHeight }}
        onScroll={handleScroll}
      >
        {children}
      </div>
      <div className="scrollable-result-fade" />
    </div>
  );
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
      <UnstyledButton
        onClick={() => setOpened(true)}
        style={{ cursor: "zoom-in", display: "block" }}
      >
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
          <ScrollableResult>
            {logEntries.map((entry) => (
              <Text
                key={entry.id}
                size="xs"
                style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
              >
                {entry.message}
              </Text>
            ))}
          </ScrollableResult>
        </Paper>
      )}

      {parsed && "returnValue" in parsed && (
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" fw={700} mb={6}>
            Return Value
          </Text>
          <ScrollableResult>
            <JsonValue value={parsed.returnValue} />
          </ScrollableResult>
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

  const args = toolCall.args && typeof toolCall.args === "object" ? toolCall.args : {};
  const action =
    typeof (args as { action?: unknown }).action === "string"
      ? ((args as { action: string }).action as "screenshot" | "extract_image" | string)
      : null;
  const isScreenshot = action === "screenshot";
  const runningLabel = isScreenshot ? "Capturing screenshot..." : "Extracting image...";
  const failureLabel = isScreenshot ? "Failed to capture screenshot" : "Failed to extract image";
  const successLabel = isScreenshot ? "Screenshot captured" : "Image extracted";
  const lightboxAlt = isScreenshot ? "Screenshot" : "Extracted image";

  if (toolCall.isRunning) {
    return (
      <Box p="md" style={{ background: "var(--mantine-color-default-hover)", borderRadius: 4 }}>
        <Group gap="xs">
          <Loader size={14} />
          <Text size="sm" c="dimmed">
            {runningLabel}
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
              {failureLabel}
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
              {successLabel}
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
        <ImageLightbox src={imageUrl} alt={lightboxAlt} />

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
            const prefix = isScreenshot ? "sitesurf-screenshot" : "sitesurf-extract";
            const filename = `${prefix}-${timestamp}.${extension}`;

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

function InspectGenericFallbackView({ toolCall }: ToolRendererContext) {
  const args = toolCall.args && typeof toolCall.args === "object" ? toolCall.args : {};
  const argsStr = Object.keys(args).length > 0 ? JSON.stringify(args, null, 2) : null;
  const resultStr =
    typeof toolCall.result === "string"
      ? toolCall.result
      : toolCall.result !== undefined
        ? JSON.stringify(toolCall.result, null, 2)
        : null;

  return (
    <>
      {argsStr && (
        <ScrollableResult maxHeight={150}>
          <Code block style={{ fontSize: 13 }}>
            {argsStr}
          </Code>
        </ScrollableResult>
      )}
      {toolCall.isRunning && !resultStr && (
        <Group gap="xs" mt="xs">
          <Loader size={14} />
          <Text size="sm" c="dimmed">
            Running {toolCall.name}...
          </Text>
        </Group>
      )}
      {resultStr && (
        <ScrollableResult maxHeight={200}>
          <Code block style={{ fontSize: 13 }}>
            {resultStr}
          </Code>
        </ScrollableResult>
      )}
    </>
  );
}

interface ParsedPickedElement {
  selector: string;
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

function parsePickedElement(result?: string): ParsedPickedElement | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.selector === "string" &&
      typeof parsed.tagName === "string"
    ) {
      return {
        selector: parsed.selector,
        tagName: parsed.tagName,
        text: typeof parsed.text === "string" ? parsed.text : "",
        attributes:
          parsed.attributes && typeof parsed.attributes === "object"
            ? (parsed.attributes as Record<string, string>)
            : {},
      };
    }
  } catch {
    // fall through
  }
  return null;
}

function InspectPickElementView({ toolCall }: ToolRendererContext) {
  const args = toolCall.args && typeof toolCall.args === "object" ? toolCall.args : {};
  const message =
    typeof (args as { message?: unknown }).message === "string"
      ? (args as { message: string }).message
      : null;

  if (toolCall.isRunning) {
    return (
      <Paper
        p="sm"
        radius="md"
        style={{
          background: "var(--mantine-color-indigo-light)",
          border: "1px solid var(--mantine-color-indigo-light-hover)",
        }}
      >
        <Group gap="sm" align="flex-start">
          <Loader size={14} />
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={600}>
              Waiting for element selection...
            </Text>
            {message && (
              <Text size="xs" c="dimmed" mt={2}>
                {message}
              </Text>
            )}
          </Box>
        </Group>
      </Paper>
    );
  }

  const picked = parsePickedElement(toolCall.result);

  if (!picked) {
    // Cancelled or unexpected shape — fall back to JSON view
    return <InspectGenericFallbackView toolCall={toolCall} consoleLogService={undefined as never} />;
  }

  const attrEntries = Object.entries(picked.attributes);
  const truncatedText =
    picked.text.length > 120 ? `${picked.text.slice(0, 120).trim()}…` : picked.text;

  return (
    <Paper
      p="sm"
      radius="md"
      mt="xs"
      style={{
        background: "var(--mantine-color-green-light)",
        border: "1px solid var(--mantine-color-green-light)",
      }}
    >
      <Group gap="sm" mb="xs">
        <MousePointerClick size={20} color="var(--mantine-color-green-6)" />
        <Text size="sm" fw={600}>
          Element selected
        </Text>
      </Group>

      <Box mb="xs">
        <Text size="xs" c="dimmed" mb={2}>
          Selector
        </Text>
        <Code block style={{ fontSize: 13, fontFamily: "monospace" }}>
          {picked.selector}
        </Code>
      </Box>

      <Group gap="md" mb="xs" wrap="wrap">
        <Box>
          <Text size="xs" c="dimmed">
            Tag
          </Text>
          <Text size="sm" ff="monospace">
            {picked.tagName.toLowerCase()}
          </Text>
        </Box>
        {truncatedText && (
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed">
              Text
            </Text>
            <Text size="sm" lineClamp={2}>
              {truncatedText}
            </Text>
          </Box>
        )}
      </Group>

      {attrEntries.length > 0 && (
        <Box>
          <Text size="xs" c="dimmed" mb={2}>
            Attributes
          </Text>
          <Code block style={{ fontSize: 12 }}>
            {attrEntries
              .slice(0, 8)
              .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
              .join("\n")}
            {attrEntries.length > 8 ? `\n...(+${attrEntries.length - 8})` : ""}
          </Code>
        </Box>
      )}
    </Paper>
  );
}

function InspectRendererView(context: ToolRendererContext) {
  const args =
    context.toolCall.args && typeof context.toolCall.args === "object"
      ? (context.toolCall.args as { action?: string })
      : {};
  // screenshot と extract_image は画像プレビュー UI
  if (args.action === "extract_image" || args.action === "screenshot") {
    return <ExtractImageRendererView {...context} />;
  }
  // pick_element は selector / tag / attrs を構造化カードで表示
  if (args.action === "pick_element") {
    return <InspectPickElementView {...context} />;
  }
  // 未知 action は generic fallback (args + result JSON)
  return <InspectGenericFallbackView {...context} />;
}

export const inspectToolRenderer: ToolRenderer = {
  renderExecuting: (context) => <InspectRendererView {...context} />,
  renderSuccess: (context) => <InspectRendererView {...context} />,
  renderError: (context) => <InspectRendererView {...context} />,
  renderSummary: createSummaryRenderer((toolCall) => {
    const args = toolCall.args && typeof toolCall.args === "object" ? toolCall.args : {};
    const action = typeof (args as { action?: unknown }).action === "string"
      ? (args as { action: string }).action
      : null;
    if (action === "extract_image") {
      const selector = typeof (args as { selector?: unknown }).selector === "string"
        ? (args as { selector: string }).selector
        : toolCall.name;
      return <Text size="sm">{selector}</Text>;
    }
    return <Text size="sm">{action ?? toolCall.name}</Text>;
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
