import type { StoredToolResult } from "@/ports/tool-result-store";

const MAX_SUMMARY_CHARS = 300;

export interface SummarizeToolResultInput {
  toolName: string;
  args: Record<string, unknown>;
  fullResult: string;
  rawValue?: unknown;
  isError: boolean;
  currentUrl?: string;
  consoleTail?: string[];
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function previewText(value: string, limit = 200): string {
  return truncate(normalizeWhitespace(value), limit);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function summarizeReadPage(input: SummarizeToolResultInput): string {
  const record = getRecord(input.rawValue);
  const text = getString(record?.text) ?? input.fullResult;
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  const parts = [
    firstLine ? `H1: ${truncate(firstLine, 80)}` : null,
    input.currentUrl ? `URL: ${input.currentUrl}` : null,
    `Body preview: ${previewText(text)}`,
  ].filter(Boolean);

  return parts.join(" / ");
}

function summarizeBgFetch(input: SummarizeToolResultInput): string {
  const items = Array.isArray(input.rawValue) ? input.rawValue : [input.rawValue];
  const urls = items
    .map((item) => {
      const record = getRecord(item);
      const url = getString(record?.url);
      if (!url) return null;
      const body = getRecord(record?.body);
      const title = getString(body?.title);
      return title ? `${url} (${truncate(title, 50)})` : url;
    })
    .filter((value): value is string => value !== null)
    .slice(0, 3);

  const successCount = items.filter((item) => getRecord(item)?.ok === true).length;
  const failCount = items.length - successCount;
  return `Fetched ${items.length} URL(s): ${urls.join(", ") || "no urls"} / success: ${successCount}/fail: ${failCount}`;
}

function summarizeRepl(input: SummarizeToolResultInput): string {
  const valueType = Array.isArray(input.rawValue)
    ? "array"
    : input.rawValue === null
      ? "null"
      : typeof input.rawValue;
  const consoleText =
    input.consoleTail && input.consoleTail.length > 0
      ? ` / console: ${previewText(input.consoleTail.join(" | "), 120)}`
      : "";
  return `return type: ${valueType} / value preview: ${previewText(input.fullResult)}${consoleText}`;
}

function summarizeNavigate(input: SummarizeToolResultInput): string {
  const record = getRecord(input.rawValue);
  const finalUrl = getString(record?.finalUrl) ?? input.currentUrl ?? "unknown";
  return `→ ${finalUrl}`;
}

function summarizeArtifacts(input: SummarizeToolResultInput): string {
  const command = getString(input.args.command) ?? "unknown";
  const filename = getString(input.args.filename) ?? "unknown";
  if (command === "get") {
    return `${filename} retrieved`;
  }
  return `${command}: ${filename}`;
}

export function summarizeToolResult(input: SummarizeToolResultInput): string {
  if (input.isError) {
    return truncate(`ERROR: ${previewText(input.fullResult, 180)}`, MAX_SUMMARY_CHARS);
  }

  if (input.fullResult === "[screenshot captured]" || input.toolName === "screenshot") {
    return "[screenshot captured]";
  }

  const summary = (() => {
    switch (input.toolName) {
      case "read_page":
        return summarizeReadPage(input);
      case "bg_fetch":
        return summarizeBgFetch(input);
      case "repl":
      case "browserjs":
        return summarizeRepl(input);
      case "navigate":
        return summarizeNavigate(input);
      case "artifacts":
        return summarizeArtifacts(input);
      case "get_tool_result":
        return previewText(input.fullResult, MAX_SUMMARY_CHARS);
      default:
        return previewText(input.fullResult, MAX_SUMMARY_CHARS);
    }
  })();

  return truncate(summary, MAX_SUMMARY_CHARS);
}

export function shouldStore(input: {
  toolName: string;
  fullResult: string;
  summary: string;
  isError: boolean;
}): boolean {
  if (input.isError) return false;
  if (input.toolName === "get_tool_result") return false;
  if (input.fullResult === "[screenshot captured]") return false;
  if (input.fullResult.length < 500) return false;
  if (input.fullResult.length - input.summary.length < 200) return false;
  return true;
}

export function createToolResultKey(): string {
  return `tc_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function formatStoredToolResultSummary(
  toolName: string,
  summary: string,
  key?: string,
): string {
  const lines = [`[${toolName}]`, summary];
  if (key) {
    lines.push(`Stored: tool_result://${key}`);
    lines.push(`Use get_tool_result("${key}") for full content.`);
  }
  return lines.join("\n");
}

export function formatRetrievedToolResult(
  result: Pick<StoredToolResult, "key" | "toolName" | "fullValue" | "summary">,
): string {
  return [
    "[get_tool_result]",
    `Restored: tool_result://${result.key}`,
    `Original tool: ${result.toolName}`,
    "Summary:",
    result.summary,
    "---",
    result.fullValue,
  ].join("\n");
}

export function restoreRetrievedToolResultToSummary(result: string): string | null {
  const match = result.match(
    /^\[get_tool_result\]\nRestored: tool_result:\/\/([^\n]+)\nOriginal tool: ([^\n]+)\nSummary:\n([\s\S]*?)\n---\n[\s\S]*$/,
  );
  if (!match) return null;
  const [, key, toolName, summary] = match;
  return formatStoredToolResultSummary(toolName, summary.trim(), key);
}
