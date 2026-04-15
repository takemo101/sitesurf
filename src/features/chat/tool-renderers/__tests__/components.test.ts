import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import type { ToolCallInfo } from "@/ports/session-types";
import { ConsoleLogService } from "../../services/console-log";
import {
  ToolMessageContainer,
  artifactsToolRenderer,
  extractImageToolRenderer,
  replToolRenderer,
} from "../components";
import type { ToolRendererContext } from "../types";

function createToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: "tool-1",
    name: "repl",
    args: { title: "Run script" },
    isRunning: false,
    ...overrides,
  };
}

function renderWithMantine(element: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(createElement(MantineProvider, null, element));
}

function renderRenderer(nodeFactory: () => ReactNode) {
  const node = nodeFactory();
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      typeof node === "string" ? createElement("div", null, node) : node,
    ),
  );
}

function createContext(toolCall: ToolCallInfo): ToolRendererContext {
  return { toolCall, consoleLogService: new ConsoleLogService() };
}

describe("ToolMessageContainer", () => {
  it("ツール名と説明をヘッダーに表示する", () => {
    const markup = renderWithMantine(
      createElement(
        ToolMessageContainer,
        { toolCall: createToolCall(), description: "Run script", defaultExpanded: true },
        createElement("div", null, "body"),
      ),
    );

    expect(markup).toContain("repl");
    expect(markup).toContain("Run script");
    expect(markup).toContain("body");
  });

  it("実行中のときは展開状態になる", () => {
    const markup = renderWithMantine(
      createElement(
        ToolMessageContainer,
        { toolCall: createToolCall({ isRunning: true }) },
        createElement("div", null, "running body"),
      ),
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("running body");
  });

  it("実行完了後は defaultExpanded 指定を尊重する", () => {
    const markup = renderWithMantine(
      createElement(
        ToolMessageContainer,
        { toolCall: createToolCall({ success: true }), defaultExpanded: false },
        createElement("div", null, "done body"),
      ),
    );

    expect(markup).toContain('aria-expanded="false"');
  });

  it("success 未設定かつ非実行中なら中立ステータスを表示する", () => {
    const markup = renderWithMantine(
      createElement(
        ToolMessageContainer,
        {
          toolCall: createToolCall({ success: undefined, isRunning: false }),
          defaultExpanded: false,
        },
        createElement("div", null, "body"),
      ),
    );

    expect(markup).toContain("status-pending");
  });
});

describe("specialized tool renderers", () => {
  it("repl renderer は実行中の表示を返す", () => {
    const markup = renderRenderer(() =>
      replToolRenderer.renderExecuting(
        createContext(
          createToolCall({
            name: "repl",
            isRunning: true,
            args: { code: "console.log('hi')" },
          }),
        ),
      ),
    );

    expect(markup).toContain("Running REPL");
  });

  it("repl renderer は実行中でも realtime log を表示できる", () => {
    const service = new ConsoleLogService();
    service.append("tool-1", { level: "log", message: "line 1", timestamp: 1 });

    const markup = renderRenderer(() =>
      replToolRenderer.renderExecuting({
        toolCall: createToolCall({
          id: "tool-1",
          name: "repl",
          isRunning: true,
          args: { code: "console.log('hi')" },
        }),
        consoleLogService: service,
      }),
    );

    expect(markup).toContain("Running REPL");
    expect(markup).toContain("line 1");
  });

  it("extract_image renderer は data URL をプレビューできる", () => {
    const markup = renderRenderer(() =>
      extractImageToolRenderer.renderSuccess(
        createContext(
          createToolCall({
            name: "extract_image",
            success: true,
            result: JSON.stringify({ dataUrl: "data:image/png;base64,abc" }),
          }),
        ),
      ),
    );

    expect(markup).toContain("Image extracted");
    expect(markup).toContain("data:image/png;base64,abc");
  });

  it("extract_image renderer は info を表示する", () => {
    const markup = renderRenderer(() =>
      extractImageToolRenderer.renderSuccess(
        createContext(
          createToolCall({
            name: "extract_image",
            success: true,
            result: JSON.stringify({
              image: {
                source: {
                  base64: "abc",
                  media_type: "image/png",
                },
              },
              info: {
                selector: "img.hero",
                originalWidth: 1200,
                originalHeight: 800,
                resizedWidth: 800,
                resizedHeight: 533,
              },
            }),
          }),
        ),
      ),
    );

    expect(markup).toContain("img.hero");
    expect(markup).toContain("1200x800");
    expect(markup).toContain("800x533");
  });

  it("repl renderer は usedSkills と files を表示する", () => {
    const markup = renderRenderer(() =>
      replToolRenderer.renderSuccess(
        createContext(
          createToolCall({
            name: "repl",
            success: true,
            args: { code: "browserjs()" },
            result: JSON.stringify({
              output: "done",
              returnValue: { ok: true },
              usedSkills: [{ skillId: "skill-1", skillName: "Extract", extractorIds: ["title"] }],
              files: [{ name: "report.txt", mimeType: "text/plain", size: 32 }],
            }),
          }),
        ),
      ),
    );

    expect(markup).toContain("Extract");
    expect(markup).toContain("title");
    expect(markup).toContain("report.txt");
    expect(markup).toContain("text/plain");
  });

  it("artifacts renderer は streaming inputDelta を表示できる", () => {
    const markup = renderRenderer(() =>
      artifactsToolRenderer.renderExecuting(
        createContext(
          createToolCall({
            name: "artifacts",
            isRunning: true,
            args: { command: "create", filename: "example.ts" },
            inputDelta: '{"content":"const answer = 42;"}',
          }),
        ),
      ),
    );

    expect(markup).toContain("Creating example.ts");
    expect(markup).toContain("const answer = 42;");
  });

  it("artifacts renderer は不正な filename 型でも落ちずに fallback 名を使う", () => {
    const markup = renderRenderer(() =>
      artifactsToolRenderer.renderSuccess(
        createContext(
          createToolCall({
            name: "artifacts",
            success: true,
            args: { command: "create", filename: 123, content: "hello" },
          }),
        ),
      ),
    );

    expect(markup).toContain("Created file");
    expect(markup).toContain("hello");
  });

  it("artifacts renderer は result の JSON payload を解釈して内容を表示する", () => {
    const markup = renderRenderer(() =>
      artifactsToolRenderer.renderSuccess(
        createContext(
          createToolCall({
            name: "artifacts",
            success: true,
            args: { command: "get", filename: "example.html" },
            result: JSON.stringify({ content: "<h1>Hello</h1>" }),
          }),
        ),
      ),
    );

    expect(markup).toContain("Read example.html");
    expect(markup).toContain("&lt;h1&gt;Hello&lt;/h1&gt;");
  });

  it("artifacts renderer は args.content がない場合に raw result を preview に流さない", () => {
    const markup = renderRenderer(() =>
      artifactsToolRenderer.renderSuccess(
        createContext(
          createToolCall({
            name: "artifacts",
            success: true,
            args: { command: "get", filename: "example.html" },
            result: "<script>alert('xss')</script>",
          }),
        ),
      ),
    );

    expect(markup).not.toContain("srcdoc=\"<script>alert('xss')</script>\"");
  });
});
