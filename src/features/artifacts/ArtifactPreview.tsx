import { useEffect, useRef, useState } from "react";
import { Box, Group, Tabs, ActionIcon, Text, Paper, useComputedColorScheme } from "@mantine/core";
import { RotateCw } from "lucide-react";
import type { ArtifactEntry } from "./types";
import { MarkdownContent } from "@/shared/ui/MarkdownContent";
import { CodeView } from "./CodeView";

interface ArtifactData {
  name: string;
  content: string | object;
  type: ArtifactEntry["type"];
}

// ============ HTML Sandbox ============

function HtmlSandbox({ html, name }: { html: string; name: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "console" | "code">("preview");
  const [logs, setLogs] = useState<Array<{ type: "log" | "error" | "warn"; text: string }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [key, setKey] = useState(0);
  const colorScheme = useComputedColorScheme();
  const isDark = colorScheme === "dark";

  // Use extension sandbox.html to avoid CSP issues
  const sandboxUrl = chrome.runtime.getURL("sandbox.html");

  // Listen for messages from sandbox
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;

      if (e.data?.type === "sandbox-ready") {
        setIsReady(true);
      } else if (e.data?.type === "console") {
        setLogs((prev) => [...prev.slice(-100), { type: e.data.method, text: e.data.text }]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send HTML to sandbox when ready
  useEffect(() => {
    if (!isReady || !iframeRef.current) return;

    // Use document.write inside the sandbox context (CSP allows this in sandbox origin)
    const renderScript = `
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
      
      // Setup console forwarding after document is written
      (function() {
        const orig = { 
          log: console.log, 
          error: console.error, 
          warn: console.warn, 
          info: console.info 
        };
        function send(method, args) {
          try {
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
            window.parent.postMessage({ type: 'console', method, text }, '*');
          } catch (e) {}
        }
        console.log = (...a) => { send('log', a); orig.log(...a); };
        console.error = (...a) => { send('error', a); orig.error(...a); };
        console.warn = (...a) => { send('warn', a); orig.warn(...a); };
        console.info = (...a) => { send('info', a); orig.info(...a); };
        window.onerror = (msg, url, line) => { 
          send('error', [msg + ' (line ' + line + ')']); 
          return false; 
        };
      })();
    `;

    iframeRef.current.contentWindow?.postMessage(
      { type: "exec", id: `artifact-${name}-${key}`, code: renderScript },
      "*",
    );
  }, [isReady, html, name, key]);

  // Reset when file changes
  useEffect(() => {
    setIsReady(false);
    setKey((k) => k + 1);
    setLogs([]);
    setIsReady(false);
  }, [html, name]);

  const consoleCount = logs.length;

  // Console colors based on theme
  const consoleBg = isDark ? "var(--mantine-color-dark-9)" : "var(--mantine-color-gray-0)";
  const consoleColor = isDark ? "var(--mantine-color-dark-0)" : "var(--mantine-color-gray-9)";
  const errorColor = isDark ? "var(--mantine-color-red-4)" : "var(--mantine-color-red-6)";
  const warnColor = isDark ? "var(--mantine-color-yellow-4)" : "var(--mantine-color-yellow-6)";

  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      {/* Tabs */}
      <Group
        px="sm"
        py={4}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Tabs
          value={activeTab}
          onChange={(v) => v && setActiveTab(v as typeof activeTab)}
          style={{ flex: 1 }}
        >
          <Tabs.List>
            <Tabs.Tab value="preview">プレビュー</Tabs.Tab>
            <Tabs.Tab value="code">コード</Tabs.Tab>
            <Tabs.Tab value="console">
              コンソール
              {consoleCount > 0 && (
                <Box
                  component="span"
                  ml={6}
                  px={4}
                  py={2}
                  style={{
                    fontSize: 10,
                    borderRadius: 4,
                    background: logs.some((l) => l.type === "error")
                      ? "var(--mantine-color-red-5)"
                      : "var(--mantine-color-indigo-5)",
                    color: "white",
                  }}
                >
                  {consoleCount}
                </Box>
              )}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {activeTab === "preview" && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => {
              setLogs([]);
              setIsReady(false);
              setKey((k) => k + 1);
            }}
          >
            <RotateCw size={14} />
          </ActionIcon>
        )}
      </Group>

      {/* Content */}
      <Box flex={1} style={{ minHeight: 0, overflow: "hidden", position: "relative" }}>
        {/* Preview */}
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: activeTab === "preview" ? "block" : "none",
          }}
        >
          <iframe
            ref={iframeRef}
            key={key}
            src={sandboxUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            sandbox="allow-scripts allow-modals allow-same-origin"
            title={name}
          />
        </Box>

        {activeTab === "code" && <CodeView content={html} filename={name} />}

        {activeTab === "console" && (
          <Box
            h="100%"
            p="xs"
            style={{
              overflow: "auto",
              background: consoleBg,
              color: consoleColor,
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            {logs.length === 0 ? (
              <Text size="xs" c="dimmed">
                コンソール出力がありません
              </Text>
            ) : (
              logs.map((log, i) => (
                <Box
                  key={i}
                  mb={4}
                  style={{
                    color:
                      log.type === "error"
                        ? errorColor
                        : log.type === "warn"
                          ? warnColor
                          : consoleColor,
                  }}
                >
                  <Text span size="xs">
                    [{log.type}] {log.text}
                  </Text>
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ============ Preview Components ============

function isCodeFile(filename: string): boolean {
  const codeExts = [
    "js",
    "ts",
    "jsx",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "cs",
    "php",
    "rb",
    "go",
    "rs",
    "swift",
    "kt",
    "scala",
    "dart",
    "html",
    "css",
    "scss",
    "json",
    "xml",
    "yaml",
    "yml",
    "sql",
    "sh",
    "bash",
    "ps1",
    "r",
    "lua",
    "pl",
    "vue",
    "svelte",
  ];
  return codeExts.includes(filename.split(".").pop()?.toLowerCase() || "");
}

function HtmlPreview({ content, name }: { content: string; name: string }) {
  return <HtmlSandbox html={content} name={name} />;
}

function MarkdownPreview({ content, name }: { content: string; name: string }) {
  const [activeTab, setActiveTab] = useState<string>("rendered");
  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <Group
        px="sm"
        py={4}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Tabs value={activeTab} onChange={(v) => v && setActiveTab(v)}>
          <Tabs.List>
            <Tabs.Tab value="rendered">表示</Tabs.Tab>
            <Tabs.Tab value="source">ソース</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Group>
      <Box flex={1} style={{ overflow: "auto", padding: "var(--mantine-spacing-sm)" }}>
        {activeTab === "rendered" ? (
          <MarkdownContent content={content} />
        ) : (
          <CodeView content={content} filename={name} />
        )}
      </Box>
    </Box>
  );
}

function CodePreview({ content, name }: { content: string; name: string }) {
  return <CodeView content={content} filename={name} />;
}

/**
 * Extract a flat array of objects from data, supporting both direct arrays
 * and wrapper objects with a single array field (e.g. { data: [...], name: "..." }).
 */
function extractTableData(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
      return data as Record<string, unknown>[];
    }
    return null;
  }
  if (typeof data === "object" && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    const isObjectArray = ([, v]: [string, unknown]) =>
      Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null;

    // Prefer well-known keys, then fall back to the longest array
    const preferredKeys = ["data", "items", "results", "rows", "records"];
    const preferred = entries.find(([k, v]) => preferredKeys.includes(k) && isObjectArray([k, v]));
    if (preferred) return preferred[1] as Record<string, unknown>[];

    const candidates = entries.filter(isObjectArray);
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b[1] as unknown[]).length - (a[1] as unknown[]).length);
      return candidates[0][1] as Record<string, unknown>[];
    }
  }
  return null;
}

const TABLE_ROW_LIMIT = 500;

function TablePreview({ rows }: { rows: Record<string, unknown>[] }) {
  // Collect all unique keys across rows (preserving insertion order from first row)
  const columnSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) columnSet.add(key);
  }
  const columns = Array.from(columnSet);
  const truncated = rows.length > TABLE_ROW_LIMIT;
  const displayRows = truncated ? rows.slice(0, TABLE_ROW_LIMIT) : rows;
  return (
    <Box style={{ overflow: "auto" }} h="100%">
      {truncated && (
        <Text size="xs" c="dimmed" px="sm" py={4}>
          {rows.length}件中 {TABLE_ROW_LIMIT}件を表示
        </Text>
      )}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          fontFamily: "monospace",
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--mantine-color-body)",
                  borderBottom: "2px solid var(--mantine-color-default-border)",
                  padding: "6px 10px",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? "transparent" : "var(--mantine-color-default-hover)",
              }}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  style={{
                    borderBottom: "1px solid var(--mantine-color-default-border)",
                    padding: "4px 10px",
                    maxWidth: 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={String(row[col] ?? "")}
                >
                  {row[col] === null || row[col] === undefined
                    ? ""
                    : typeof row[col] === "object"
                      ? JSON.stringify(row[col])
                      : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function DataPreview({ content, name }: { content: string | object; name: string }) {
  const formatted = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const jsonObj =
    typeof content === "string"
      ? (() => {
          try {
            return JSON.parse(content);
          } catch {
            return null;
          }
        })()
      : content;

  const tableRows = extractTableData(jsonObj);
  const hasTable = tableRows !== null && tableRows.length > 0;
  const [activeTab, setActiveTab] = useState<string>(hasTable ? "table" : "formatted");

  // Reset tab when content changes
  useEffect(() => {
    setActiveTab(hasTable ? "table" : "formatted");
  }, [name, hasTable]);

  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <Group
        px="sm"
        py={4}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Tabs value={activeTab} onChange={(v) => v && setActiveTab(v)}>
          <Tabs.List>
            {hasTable && <Tabs.Tab value="table">テーブル ({tableRows.length})</Tabs.Tab>}
            <Tabs.Tab value="formatted">整形</Tabs.Tab>
            <Tabs.Tab value="source">ソース</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Group>
      <Box flex={1} style={{ overflow: "auto", minHeight: 0 }}>
        {activeTab === "table" && hasTable ? (
          <TablePreview rows={tableRows} />
        ) : activeTab === "formatted" && jsonObj ? (
          <Box p="sm">
            <CodeView content={JSON.stringify(jsonObj, null, 2)} filename={name} />
          </Box>
        ) : (
          <CodeView content={formatted} filename={name} />
        )}
      </Box>
    </Box>
  );
}

function ImagePreview({ content, name }: { content: string; name: string }) {
  return (
    <Box
      h="100%"
      p="md"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={content}
        alt={name}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
      />
    </Box>
  );
}

function DefaultPreview({ content, name }: { content: string | object; name: string }) {
  const str = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return <CodeView content={str} filename={name} />;
}

// ============ Main Component ============

interface ArtifactPreviewProps {
  data: ArtifactData;
}

export function ArtifactPreview({ data }: ArtifactPreviewProps) {
  if (!data) {
    return (
      <Paper
        withBorder
        radius="sm"
        p="xl"
        h="100%"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Text c="dimmed">アーティファクトが選択されていません</Text>
      </Paper>
    );
  }

  const { name, content, type } = data;
  const stringContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <Paper
      withBorder
      radius="sm"
      h="100%"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <Box flex={1} style={{ minHeight: 0, overflow: "hidden" }}>
        {type === "html" ? (
          <HtmlPreview content={stringContent} name={name} />
        ) : type === "markdown" ? (
          <MarkdownPreview content={stringContent} name={name} />
        ) : type === "image" ? (
          <ImagePreview content={stringContent} name={name} />
        ) : type === "json" ? (
          <DataPreview content={content} name={name} />
        ) : isCodeFile(name) ? (
          <CodePreview content={stringContent} name={name} />
        ) : (
          <DefaultPreview content={content} name={name} />
        )}
      </Box>
    </Paper>
  );
}
