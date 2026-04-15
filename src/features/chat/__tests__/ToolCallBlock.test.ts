import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";
import type { ToolCallInfo } from "@/ports/session-types";
import { ToolCallBlock, downloadImageResource, formatArgs } from "../ToolCallBlock";

function renderWithMantine(element: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(createElement(MantineProvider, null, element));
}

function createToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: "tool-1",
    name: "read_page",
    args: { selector: "body" },
    isRunning: false,
    ...overrides,
  };
}

describe("formatArgs", () => {
  it("code フィールドがある場合はコード文字列を返す", () => {
    const result = formatArgs({ code: "document.title" });
    expect(result).toBe("document.title");
  });

  it("code フィールドが文字列以外の場合は JSON にフォールバックする", () => {
    const result = formatArgs({ code: 123, other: "val" });
    expect(result).toBe(JSON.stringify({ code: 123, other: "val" }, null, 2));
  });

  it("code フィールドがない場合は JSON.stringify で返す", () => {
    const result = formatArgs({ selector: "body", format: "text" });
    expect(result).toBe(JSON.stringify({ selector: "body", format: "text" }, null, 2));
  });

  it("空オブジェクトの場合は null を返す", () => {
    const result = formatArgs({});
    expect(result).toBeNull();
  });

  it("description のみの場合も JSON で返す", () => {
    const result = formatArgs({ description: "ページを読み込み" });
    expect(result).toBe(JSON.stringify({ description: "ページを読み込み" }, null, 2));
  });
});

describe("downloadImageResource", () => {
  it("chrome.downloads.download があればそれを優先して使う", async () => {
    const download =
      vi.fn<
        (options: { url: string; filename: string; saveAs: boolean }) => Promise<number | undefined>
      >();
    download.mockResolvedValue(1);

    await downloadImageResource("data:image/png;base64,abc", "test.png", { download });

    expect(download).toHaveBeenCalledWith({
      url: "data:image/png;base64,abc",
      filename: "test.png",
      saveAs: false,
    });
  });

  it("download が undefined を返した場合はエラーにする", async () => {
    const download =
      vi.fn<
        (options: { url: string; filename: string; saveAs: boolean }) => Promise<number | undefined>
      >();
    download.mockResolvedValue(undefined);

    await expect(
      downloadImageResource("data:image/png;base64,abc", "test.png", { download }),
    ).rejects.toThrow("ダウンロード開始に失敗しました");
  });

  it("download API がない場合は anchor fallback を使う", async () => {
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      style: { display: "" },
      click,
    } as unknown as HTMLAnchorElement;

    const appendAnchor = vi.fn();
    const removeAnchor = vi.fn();

    await downloadImageResource("data:image/png;base64,abc", "fallback.png", {
      download: undefined,
      createAnchor: () => anchor,
      appendAnchor,
      removeAnchor,
    });

    expect(anchor.href).toBe("data:image/png;base64,abc");
    expect(anchor.download).toBe("fallback.png");
    expect(anchor.style.display).toBe("none");
    expect(appendAnchor).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledTimes(1);
    expect(removeAnchor).toHaveBeenCalledWith(anchor);
  });
});

describe("ToolCallBlock", () => {
  it("specialized repl renderer を使って実行中表示を出す", () => {
    const markup = renderWithMantine(
      createElement(ToolCallBlock, {
        tc: createToolCall({
          name: "repl",
          isRunning: true,
          args: { code: "console.log('hi')" },
        }),
      }),
    );

    expect(markup).toContain("Running REPL");
    expect(markup).toContain('aria-expanded="true"');
  });

  it("未登録ツールは汎用フォールバックで表示する", () => {
    const markup = renderWithMantine(
      createElement(ToolCallBlock, {
        tc: createToolCall({
          name: "read_page",
          isRunning: true,
          success: true,
          result: "plain result",
          args: { selector: "body", format: "text" },
        }),
      }),
    );

    expect(markup).toContain("read_page");
    expect(markup).toContain("selector");
    expect(markup).toContain("body");
    expect(markup).toContain("plain result");
  });
});
