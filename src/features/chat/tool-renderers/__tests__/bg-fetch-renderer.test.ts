import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import type { ToolCallInfo } from "@/ports/session-types";
import { defaultConsoleLogService } from "../../services/console-log";
import { bgFetchToolRenderer } from "../bg-fetch-renderer";

function renderWithMantine(element: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(createElement(MantineProvider, null, element));
}

function createToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: "tool-1",
    name: "bg_fetch",
    args: { urls: ["https://example.com"], response_type: "readability" },
    isRunning: false,
    ...overrides,
  };
}

describe("bgFetchToolRenderer", () => {
  it("success result をカード表示に変換する", () => {
    const markup = renderWithMantine(
      createElement(() =>
        bgFetchToolRenderer.renderSuccess({
          toolCall: createToolCall({
            success: true,
            result: JSON.stringify([
              {
                url: "https://example.com/article",
                ok: true,
                status: 200,
                statusText: "OK",
                headers: {},
                body: { title: "Example Article", content: "Hello world" },
              },
              {
                url: "https://example.org/missing",
                ok: false,
                status: 404,
                statusText: "Not Found",
                headers: {},
                body: "",
                error: "missing",
              },
            ]),
          }),
          consoleLogService: defaultConsoleLogService,
        }),
      ),
    );

    expect(markup).toContain("1/2 成功");
    expect(markup).toContain("Example Article");
    expect(markup).toContain("404");
    expect(markup).toContain("example.com");
    expect(markup).toContain("example.org");
  });

  it("error result をエラーメッセージ表示に変換する", () => {
    const markup = renderWithMantine(
      createElement(() =>
        bgFetchToolRenderer.renderError({
          toolCall: createToolCall({
            success: false,
            result: "Fetch failed hard",
          }),
          consoleLogService: defaultConsoleLogService,
        }),
      ),
    );

    expect(markup).toContain("Fetch failed hard");
  });
});
