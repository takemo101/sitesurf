import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { Result } from "@/shared/errors";
import { ok } from "@/shared/errors";

export interface ScreenshotResult {
  dataUrl: string;
}

export const screenshotToolDef: ToolDefinition = {
  name: "screenshot",
  description:
    "現在表示されているページの可視領域のスクリーンショットを撮影する。ページの視覚的な状態を確認したい時に使う。",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export async function executeScreenshot(
  browser: BrowserExecutor,
): Promise<Result<ScreenshotResult, never>> {
  const dataUrl = await browser.captureScreenshot();
  return ok({ dataUrl });
}
