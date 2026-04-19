import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor, ElementInfo } from "@/ports/browser-executor";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import {
  executeExtractImage,
  executeExtractImages,
  type ExtractImageResult,
  type ExtractImagesResult,
} from "@/shared/extract-image-core";

export type { ExtractImageResult, ExtractImagesResult };

export interface ScreenshotResult {
  dataUrl: string;
}

/** Maximum number of selectors allowed per extract_image call. Guards against
 * bulk collection misuse — beyond this the base64 payload gets truncated. */
const EXTRACT_IMAGE_BULK_LIMIT = 5;

export const inspectToolDef: ToolDefinition = {
  name: "inspect",
  description: `Inspect the current page visually or interactively. Choose an action:
- pick_element: Ask the user to click an element to select it. Returns CSS selector, tag, text, and attributes.
- screenshot: Capture a screenshot of the visible viewport. Use to check the page's visual state.
- extract_image: Return raw image bytes so you can VISUALLY analyze one or a few images (read a chart, judge a layout, inspect a design). Max 3-5 selectors per call. Not for bulk collection — if the user wants "all images on the page" to download/view later, use browserjs() to get URLs, then returnFile() to deliver a list. Pass \`selector\` for a single image or \`selectors\` for a small set.`,
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
          "(extract_image only) CSS selector for a single image element (e.g. 'img.hero', '#logo', 'canvas#main', 'video'). Use `selectors` instead to extract multiple images in one call.",
      },
      selectors: {
        type: "array",
        items: { type: "string" },
        description:
          "(extract_image only) Multiple CSS selectors to extract in a single call. Prefer this over several separate inspect calls when you need two or more images.",
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
    selectors?: string[];
    maxWidth?: number;
  },
): Promise<
  Result<
    ElementInfo | null | ScreenshotResult | ExtractImageResult | ExtractImagesResult,
    ToolError | BrowserError
  >
> {
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
      const maxWidth = typeof args.maxWidth === "number" ? args.maxWidth : undefined;
      const hasPlural = Array.isArray(args.selectors) && args.selectors.length > 0;
      if (hasPlural) {
        const count = args.selectors!.length;
        if (count > EXTRACT_IMAGE_BULK_LIMIT) {
          return err({
            code: "tool_script_error",
            message: `extract_image was called with ${count} selectors. This tool is for visually analyzing 1-${EXTRACT_IMAGE_BULK_LIMIT} images — large fan-outs return truncated base64 and deliver nothing usable. To collect many images for the user, do this instead: (1) browserjs() to gather URLs, (2) createOrUpdateArtifact() to stage, (3) returnFile() to hand off an HTML/CSV/JSON list. Retry with at most ${EXTRACT_IMAGE_BULK_LIMIT} selectors, or switch to the browserjs + returnFile pattern.`,
          });
        }
        return executeExtractImages(browser, { selectors: args.selectors!, maxWidth });
      }
      if (typeof args.selector !== "string") {
        return {
          ok: false as const,
          error: {
            code: "tool_script_error",
            message: "selector or selectors is required for extract_image",
          },
        };
      }
      return executeExtractImage(browser, { selector: args.selector, maxWidth });
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
