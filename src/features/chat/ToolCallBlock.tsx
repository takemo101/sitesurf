import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Code,
  Loader,
  Modal,
  Paper,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  ChevronDown,
  ChevronUp,
  FileCode,
  Globe,
  Image as ImageIcon,
  Terminal,
} from "lucide-react";
import type { ToolCallInfo } from "@/ports/session-types";
import { useDeps } from "@/shared/deps-context";
import { useStore } from "@/store";
import type { ToolResultStorePort } from "@/ports/tool-result-store";
import { defaultConsoleLogService } from "./services/console-log";
import { defaultToolRendererRegistry } from "./tool-renderers";
import { ImageLightbox, ScrollableResult, ToolMessageContainer } from "./tool-renderers/components";
import type { ToolRendererContext } from "./tool-renderers/types";

export function formatArgs(args: Record<string, unknown> | unknown): string | null {
  if (!args || typeof args !== "object") return typeof args === "string" ? args : null;
  if ("code" in args && typeof args.code === "string") {
    return args.code;
  }
  if (Object.keys(args).length > 0) {
    return JSON.stringify(args, null, 2);
  }
  return null;
}

type DownloadApi = (options: {
  url: string;
  filename: string;
  saveAs: boolean;
}) => Promise<number | undefined>;

export async function downloadImageResource(
  imageUrl: string,
  filename: string,
  deps: {
    download?: DownloadApi;
    createAnchor?: () => HTMLAnchorElement;
    appendAnchor?: (anchor: HTMLAnchorElement) => void;
    removeAnchor?: (anchor: HTMLAnchorElement) => void;
  } = {},
): Promise<void> {
  const chromeDownloads = (globalThis as { chrome?: typeof chrome }).chrome?.downloads;
  const download = deps.download ?? chromeDownloads?.download?.bind(chromeDownloads);

  if (download) {
    const downloadId = await download({ url: imageUrl, filename, saveAs: false });
    if (downloadId === undefined) {
      throw new Error("ダウンロード開始に失敗しました");
    }
    return;
  }

  const canUseDocument = typeof document !== "undefined";
  if (!canUseDocument && !deps.createAnchor) {
    throw new Error("ダウンロードAPIが利用できません");
  }

  const anchor = deps.createAnchor ? deps.createAnchor() : document.createElement("a");
  anchor.href = imageUrl;
  anchor.download = filename;
  anchor.style.display = "none";

  const appendAnchor =
    deps.appendAnchor ?? ((a: HTMLAnchorElement) => document.body.appendChild(a));
  const removeAnchor =
    deps.removeAnchor ?? ((a: HTMLAnchorElement) => document.body.removeChild(a));

  appendAnchor(anchor);
  anchor.click();
  removeAnchor(anchor);
}

const RESULT_MAX_LENGTH = 500;

export function getStoredToolResultKey(result?: string): string | null {
  if (!result) return null;
  const match = result.match(/(?:^|\n)Stored: tool_result:\/\/([^\n]+)/);
  return match?.[1]?.trim() || null;
}

export async function loadStoredToolResult(
  store: ToolResultStorePort,
  sessionId: string,
  key: string,
): Promise<{ toolName: string; fullResult: string }> {
  const stored = await store.get(sessionId, key);
  if (!stored) {
    throw new Error("保存済みの完全結果が見つかりませんでした。");
  }

  return {
    toolName: stored.toolName,
    fullResult: stored.fullValue,
  };
}

function extractImageUrl(result: string): string | null {
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

function tryParseJson(value?: string): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function JsonValueNode({ label, value }: { label?: string; value: unknown }) {
  const isObject = value !== null && typeof value === "object";
  const [open, setOpen] = useState(true);

  if (!isObject) {
    return (
      <Text
        size="xs"
        style={{
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {label ? `${label}: ` : ""}
        {JSON.stringify(value)}
      </Text>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <Box>
      <UnstyledButton
        onClick={() => setOpen((current) => !current)}
        style={{ display: "flex", gap: 6 }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        <Text size="xs" style={{ fontFamily: "monospace" }}>
          {label ? `${label}: ` : ""}
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </Text>
      </UnstyledButton>
      <Collapse expanded={open}>
        <Box mt={2} pl="sm">
          {entries.map(([key, entryValue]) => (
            <JsonValueNode key={key} label={key} value={entryValue} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function StoredToolResultButton({ result }: { result?: string }) {
  const { toolResultStore } = useDeps();
  const activeSessionId = useStore((s) => s.activeSessionId);
  const key = getStoredToolResultKey(result);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullResult, setFullResult] = useState<string | null>(null);
  const [toolName, setToolName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    if (!activeSessionId || !key) {
      setError("完全結果を開くためのセッション情報が見つかりませんでした。");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadStoredToolResult(toolResultStore, activeSessionId, key)
      .then((stored) => {
        if (cancelled) return;
        setFullResult(stored.fullResult);
        setToolName(stored.toolName);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setFullResult(null);
        setToolName(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, key, opened, toolResultStore]);

  if (!key) return null;

  return (
    <>
      <Button size="compact-xs" variant="subtle" mt={8} onClick={() => setOpened(true)}>
        完全結果を展開
      </Button>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={toolName ? `${toolName} の完全結果` : "ツール結果の完全版"}
        size="lg"
      >
        {loading ? (
          <Box py="md" style={{ display: "flex", justifyContent: "center" }}>
            <Loader size="sm" />
          </Box>
        ) : error ? (
          <Text size="sm" c="red" style={{ whiteSpace: "pre-wrap" }}>
            {error}
          </Text>
        ) : (
          <ScrollableResult maxHeight={480}>
            <Code block style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {fullResult ?? ""}
            </Code>
          </ScrollableResult>
        )}
      </Modal>
    </>
  );
}

function GenericToolResult({ toolCall }: { toolCall: ToolCallInfo }) {
  const isSuccess = toolCall.success === true;
  const isError = toolCall.success === false;
  const imageUrl = !isError && toolCall.result ? extractImageUrl(toolCall.result) : null;
  const parsedJson = !isError ? tryParseJson(toolCall.result) : null;
  const canShowStructuredJson =
    parsedJson !== null && (typeof parsedJson === "object" || Array.isArray(parsedJson));

  return (
    <Box mt={4} pt={4} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
      {imageUrl ? (
        <ImageLightbox src={imageUrl} alt="Screenshot" />
      ) : canShowStructuredJson ? (
        <Paper withBorder p="sm" radius="md" style={{ maxWidth: "100%", overflowX: "auto" }}>
          <Text size="xs" fw={700} mb={6}>
            Result
          </Text>
          <ScrollableResult>
            <JsonValueNode value={parsedJson} />
          </ScrollableResult>
        </Paper>
      ) : (
        <Text
          size="xs"
          c={isSuccess ? "green" : isError ? "red" : "dimmed"}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
        >
          {toolCall.result?.substring(0, RESULT_MAX_LENGTH)}
          {toolCall.result && toolCall.result.length > RESULT_MAX_LENGTH && "..."}
        </Text>
      )}
    </Box>
  );
}

function renderSpecializedToolBody(toolCall: ToolCallInfo) {
  const renderer = defaultToolRendererRegistry.get(toolCall.name);
  if (!renderer) return null;

  const context: ToolRendererContext = { toolCall, consoleLogService: defaultConsoleLogService };
  if (toolCall.isRunning) return renderer.renderExecuting(context);
  if (toolCall.success === false) return renderer.renderError(context);
  if (toolCall.success !== true && toolCall.result === undefined) return null;
  return renderer.renderSuccess(context);
}

function getToolDescription(toolCall: ToolCallInfo): string | null {
  const args = toolCall.args && typeof toolCall.args === "object" ? toolCall.args : {};

  return (
    ("title" in args && typeof args.title === "string" && args.title) ||
    ("description" in args && typeof args.description === "string" && args.description) ||
    (toolCall.name === "artifacts" && (args as { filename?: string }).filename) ||
    (toolCall.name === "extract_image" && (args as { selector?: string }).selector) ||
    null
  );
}

function getToolIcon(toolName: string) {
  if (toolName === "artifacts") {
    return <FileCode size={14} color="var(--mantine-color-indigo-5)" />;
  }

  if (toolName === "extract_image") {
    return <ImageIcon size={14} color="var(--mantine-color-green-5)" />;
  }

  if (toolName === "bg_fetch") {
    return <Globe size={14} color="var(--mantine-color-cyan-5)" />;
  }

  return <Terminal size={14} color="var(--mantine-color-indigo-5)" />;
}

export function ToolCallBlock({ tc }: { tc: ToolCallInfo }) {
  const renderer = defaultToolRendererRegistry.get(tc.name);
  const argsStr = formatArgs(tc.args);
  const description = getToolDescription(tc);
  const summary = renderer?.renderSummary({
    toolCall: tc,
    consoleLogService: defaultConsoleLogService,
  });
  const specializedBody = renderSpecializedToolBody(tc);

  return (
    <>
      <ToolMessageContainer
        toolCall={tc}
        description={renderer ? null : description}
        summary={summary}
        icon={getToolIcon(tc.name)}
        defaultExpanded={tc.name === "repl"}
      >
        {renderer ? (
          specializedBody
        ) : (
          <>
            {argsStr && (
              <ScrollableResult maxHeight={150}>
                <Code block style={{ fontSize: 13 }}>
                  {argsStr}
                </Code>
              </ScrollableResult>
            )}
            {(tc.result || tc.isRunning) && <GenericToolResult toolCall={tc} />}
          </>
        )}
      </ToolMessageContainer>
      <StoredToolResultButton result={tc.result} />
    </>
  );
}
