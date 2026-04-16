import { useState } from "react";
import {
  Badge,
  Box,
  Collapse,
  Group,
  Loader,
  Paper,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  CheckCircle,
  ChevronDown,
  ExternalLink,
  XCircle,
} from "lucide-react";
import type { ToolRenderer, ToolRendererContext } from "./types";

interface FetchResultItem {
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | object;
  redirected?: boolean;
  redirectUrl?: string;
  error?: string;
}

function getFavicon(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=16`;
  } catch {
    return "";
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "green";
  if (status >= 300 && status < 400) return "blue";
  if (status >= 400 && status < 500) return "orange";
  return "red";
}

function getBodyPreview(body: string | object): string {
  if (typeof body === "object" && body !== null) {
    if ("title" in body && typeof (body as { title?: string }).title === "string") {
      return (body as { title: string }).title;
    }
    if ("content" in body && typeof (body as { content?: string }).content === "string") {
      return (body as { content: string }).content.substring(0, 100);
    }
    return JSON.stringify(body).substring(0, 100);
  }
  return body.substring(0, 100);
}

function FetchResultCard({ item }: { item: FetchResultItem }) {
  const [expanded, setExpanded] = useState(false);
  const hostname = getHostname(item.url);
  const favicon = getFavicon(item.url);
  const preview = item.ok ? getBodyPreview(item.body) : item.error || item.statusText;

  return (
    <Paper
      radius="sm"
      withBorder
      style={{
        borderColor: item.ok
          ? "var(--mantine-color-green-3)"
          : "var(--mantine-color-red-3)",
        overflow: "hidden",
      }}
    >
      <UnstyledButton
        onClick={() => setExpanded((prev) => !prev)}
        w="100%"
        px="sm"
        py={8}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <img
          src={favicon}
          alt=""
          width={14}
          height={14}
          style={{ borderRadius: 2, flexShrink: 0 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <Text size="xs" fw={600} truncate style={{ flex: 1 }}>
          {hostname}
        </Text>
        {item.status > 0 && (
          <Badge size="xs" variant="light" color={getStatusColor(item.status)}>
            {item.status}
          </Badge>
        )}
        {item.ok ? (
          <CheckCircle size={12} color="var(--mantine-color-green-5)" />
        ) : (
          <XCircle size={12} color="var(--mantine-color-red-5)" />
        )}
        <ChevronDown
          size={12}
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            opacity: 0.4,
          }}
        />
      </UnstyledButton>

      {!expanded && preview && (
        <Text size="xs" c="dimmed" px="sm" pb={6} truncate>
          {preview}
        </Text>
      )}

      <Collapse expanded={expanded}>
        <Box
          px="sm"
          pb="sm"
          style={{
            borderTop: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <Text
            size="xs"
            c="dimmed"
            mt={6}
            style={{
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {item.url}
          </Text>

          {item.redirected && item.redirectUrl && (
            <Group gap={4} mt={4}>
              <ExternalLink size={10} />
              <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                → {item.redirectUrl}
              </Text>
            </Group>
          )}

          {item.ok && (
            <Paper
              mt={8}
              p="xs"
              radius="sm"
              style={{
                background: "var(--mantine-color-default-hover)",
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              <Text
                size="xs"
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                }}
              >
                {typeof item.body === "string"
                  ? item.body.substring(0, 2000)
                  : JSON.stringify(item.body, null, 2).substring(0, 2000)}
              </Text>
            </Paper>
          )}

          {!item.ok && item.error && (
            <Text size="xs" c="red" mt={4}>
              {item.error}
            </Text>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

function parseResult(result?: string): FetchResultItem[] {
  if (!result) return [];
  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === "object" && parsed !== null && "url" in parsed) return [parsed];
    return [];
  } catch {
    return [];
  }
}

function getUrls(args: Record<string, unknown>): string[] {
  if (Array.isArray(args.urls)) return args.urls.filter((u) => typeof u === "string");
  return [];
}

function BgFetchExecuting({ toolCall }: ToolRendererContext) {
  const urls = getUrls(toolCall.args);
  const responseType = typeof toolCall.args.response_type === "string"
    ? toolCall.args.response_type
    : "text";

  return (
    <Box>
      <Group gap={6} mb={8}>
        <Badge size="xs" variant="light" color="indigo">
          {responseType}
        </Badge>
        <Text size="xs" c="dimmed">
          {urls.length} URL{urls.length > 1 ? "s" : ""} を取得中
        </Text>
      </Group>
      <Box style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {urls.map((url) => (
          <Group key={url} gap={6} px={4} py={2}>
            <Loader size={10} type="dots" />
            <img
              src={getFavicon(url)}
              alt=""
              width={12}
              height={12}
              style={{ borderRadius: 2 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <Text size="xs" c="dimmed" truncate style={{ fontFamily: "monospace" }}>
              {getHostname(url)}
            </Text>
          </Group>
        ))}
      </Box>
    </Box>
  );
}

function BgFetchSuccess({ toolCall }: ToolRendererContext) {
  const items = parseResult(toolCall.result);
  const responseType = typeof toolCall.args.response_type === "string"
    ? toolCall.args.response_type
    : "text";
  const successCount = items.filter((i) => i.ok).length;

  return (
    <Box>
      <Group gap={6} mb={8}>
        <Badge size="xs" variant="light" color="indigo">
          {responseType}
        </Badge>
        <Text size="xs" c="dimmed">
          {successCount}/{items.length} 成功
        </Text>
      </Group>
      <Box style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item) => (
          <FetchResultCard key={item.url} item={item} />
        ))}
      </Box>
    </Box>
  );
}

function BgFetchError({ toolCall }: ToolRendererContext) {
  return (
    <Box p="xs" style={{ background: "var(--mantine-color-red-light)", borderRadius: 4 }}>
      <Group gap={6}>
        <XCircle size={14} color="var(--mantine-color-red-5)" />
        <Text size="xs" c="red">
          {toolCall.result || "Fetch failed"}
        </Text>
      </Group>
    </Box>
  );
}

export const bgFetchToolRenderer: ToolRenderer = {
  renderExecuting: (context) => <BgFetchExecuting {...context} />,
  renderSuccess: (context) => <BgFetchSuccess {...context} />,
  renderError: (context) => <BgFetchError {...context} />,
  renderSummary: ({ toolCall }) => {
    const urls = getUrls(toolCall.args);
    const responseType = typeof toolCall.args.response_type === "string"
      ? toolCall.args.response_type
      : "text";
    return (
      <Group gap={6}>
        <Badge size="xs" variant="light" color="indigo">
          {responseType}
        </Badge>
        <Text size="xs" c="dimmed">
          {urls.length} URL{urls.length > 1 ? "s" : ""}
        </Text>
      </Group>
    );
  },
};
