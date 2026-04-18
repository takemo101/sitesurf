import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor, ElementInfo } from "@/ports/browser-executor";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import { executeExtractImage, type ExtractImageResult } from "@/shared/extract-image-core";

export type { ExtractImageResult };

export interface ScreenshotResult {
  dataUrl: string;
}

export const inspectToolDef: ToolDefinition = {
  name: "inspect",
  description: `Inspect the current page visually or interactively. Choose an action:
- pick_element: Ask the user to click an element to select it. Returns CSS selector, tag, text, and attributes.
- screenshot: Capture a screenshot of the visible viewport. Use to check the page's visual state.
- extract_image: Extract an image from the page (img, canvas, video, background-image). Returns image data.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["pick_element", "screenshot", "extract_image"],
        description: "Which inspection action to perform.",
      },
      message: {
        type: "string",
        description:
          "(pick_element only) Message shown to the user (e.g. 'Click the element you want to operate on').",
      },
      selector: {
        type: "string",
        description:
          "(extract_image only) CSS selector for the image element (e.g. 'img.hero', '#logo', 'canvas#main', 'video').",
      },
      maxWidth: {
        type: "number",
        description:
          "(extract_image only) Max width to resize image to (default 800). Reduces token usage.",
        default: 800,
      },
    },
    required: ["action"],
  },
};

export async function executeInspect(
  browser: BrowserExecutor,
  args: {
    action: "pick_element" | "screenshot" | "extract_image";
    message?: string;
    selector?: string;
    maxWidth?: number;
  },
): Promise<Result<ElementInfo | null | ScreenshotResult | ExtractImageResult, ToolError | BrowserError>> {
  switch (args.action) {
    case "pick_element": {
      const tab = await browser.getActiveTab();
      if (tab.id === null) {
        return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
      }
      return browser.injectElementPicker(tab.id, args.message);
    }
    case "screenshot": {
      const dataUrl = await browser.captureScreenshot();
      return ok({ dataUrl });
    }
    case "extract_image": {
      if (typeof args.selector !== "string") {
        return {
          ok: false as const,
          error: { code: "tool_script_error", message: "selector is required for extract_image" },
        };
      }
      return executeExtractImage(browser, {
        selector: args.selector,
        maxWidth: typeof args.maxWidth === "number" ? args.maxWidth : undefined,
      });
    }
    default: {
      const exhaustive: never = args.action;
      return {
        ok: false as const,
        error: { code: "tool_script_error", message: `Unknown action: ${String(exhaustive)}` },
      };
    }
  }
}
