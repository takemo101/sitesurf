import type { BrowserExecutor } from "@/ports/browser-executor";
import type { Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import { createLogger } from "@/shared/logger";

const log = createLogger("extract-image");

export interface ExtractImageResult {
  image: {
    type: "image";
    source: {
      type: "base64";
      base64: string;
      media_type: "image/png" | "image/jpeg" | "image/webp";
    };
  };
  info: {
    selector: string;
    originalWidth: number;
    originalHeight: number;
    resizedWidth: number;
    resizedHeight: number;
  };
}

interface VideoFallbackInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

type ScriptSuccess = { success: true; src: string; width: number; height: number };
type ScriptFailure = {
  success: false;
  error: string;
  fallback?: { type: "video-screenshot"; rect: VideoFallbackInfo };
};

type ScriptResultData = ScriptSuccess | ScriptFailure | undefined;

export async function executeExtractImage(
  browser: BrowserExecutor,
  args: { selector: string; maxWidth?: number },
): Promise<Result<ExtractImageResult, ToolError>> {
  const maxWidth = args.maxWidth ?? 800;
  return extractElementImage(browser, args.selector, maxWidth);
}

export type ExtractImagesItem =
  | ({ ok: true; selector: string } & ExtractImageResult)
  | { ok: false; selector: string; error: string };

export interface ExtractImagesResult {
  images: ExtractImagesItem[];
}

/**
 * 複数セレクタの画像を 1 回のツール呼び出しで順に抽出する。個別の失敗は
 * items に `{ok: false, error}` として残し、全体としては成功を返す。
 */
export async function executeExtractImages(
  browser: BrowserExecutor,
  args: { selectors: string[]; maxWidth?: number },
): Promise<Result<ExtractImagesResult, ToolError>> {
  const maxWidth = args.maxWidth ?? 800;
  const items: ExtractImagesItem[] = [];
  for (const selector of args.selectors) {
    const r = await extractElementImage(browser, selector, maxWidth);
    if (r.ok) {
      items.push({ ok: true, selector, ...r.value });
    } else {
      items.push({ ok: false, selector, error: r.error.message });
    }
  }
  return ok({ images: items });
}

async function extractElementImage(
  browser: BrowserExecutor,
  selector: string,
  maxWidth: number,
): Promise<Result<ExtractImageResult, ToolError>> {
  const tab = await browser.getActiveTab();
  if (!tab.id) {
    return err({
      code: "tool_tab_not_found",
      message: "アクティブタブが見つかりません",
    });
  }

  const code = `(async () => {
    const sel = ${JSON.stringify(selector)};
    const el = document.querySelector(sel);
    if (!el) return { success: false, error: 'No element found for selector: ' + sel };

    if (el instanceof HTMLImageElement) {
      if (!el.complete) {
        await new Promise((resolve, reject) => {
          el.onload = resolve;
          el.onerror = () => reject(new Error('Image failed to load'));
          setTimeout(() => reject(new Error('Image load timeout')), 10000);
        });
      }
      const src = el.currentSrc || el.src;
      if (!src) return { success: false, error: 'Image has no src' };
      return { success: true, src, width: el.naturalWidth, height: el.naturalHeight };
    }

    if (el instanceof HTMLCanvasElement) {
      try {
        const dataUrl = el.toDataURL('image/png');
        return { success: true, src: dataUrl, width: el.width, height: el.height };
      } catch (e) {
        return { success: false, error: 'Cannot read canvas: ' + e.message };
      }
    }

    if (el instanceof HTMLVideoElement) {
      const rect = el.getBoundingClientRect();
      const fallbackRect = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      if (el.readyState < 2 || el.videoWidth <= 0 || el.videoHeight <= 0) {
        return {
          success: false,
          error: 'Video not ready',
          fallback: { type: 'video-screenshot', rect: fallbackRect },
        };
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = el.videoWidth;
        canvas.height = el.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return {
            success: false,
            error: 'Cannot get 2d context',
            fallback: { type: 'video-screenshot', rect: fallbackRect },
          };
        }
        ctx.drawImage(el, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        return { success: true, src: dataUrl, width: el.videoWidth, height: el.videoHeight };
      } catch (e) {
        return {
          success: false,
          error: 'Cannot capture video frame: ' + e.message,
          fallback: { type: 'video-screenshot', rect: fallbackRect },
        };
      }
    }

    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\\(["']?(.+?)["']?\\)/);
      if (match) return { success: true, src: match[1], width: 0, height: 0 };
    }

    return {
      success: false,
      error: 'Element <' + el.tagName.toLowerCase() + '> is not an image, canvas, video, or element with background-image'
    };
  })()`;

  const scriptResult = await browser.executeScript(tab.id, code);
  if (!scriptResult.ok) return err(scriptResult.error);

  const result = scriptResult.value.value as ScriptResultData;
  if (!result) {
    return err({ code: "tool_script_error", message: "スクリプト結果なし" });
  }

  if (!result.success) {
    if (result.fallback?.type === "video-screenshot") {
      try {
        const fallbackImage = await captureAndCropVideoFallback(
          browser,
          result.fallback.rect,
          maxWidth,
        );
        return ok({
          image: fallbackImage.image,
          info: {
            selector,
            originalWidth: Math.round(result.fallback.rect.width),
            originalHeight: Math.round(result.fallback.rect.height),
            resizedWidth: fallbackImage.width,
            resizedHeight: fallbackImage.height,
          },
        });
      } catch (e: unknown) {
        try {
          const fullScreenshot = await captureAndResizeScreenshot(browser, maxWidth);
          return ok({
            image: fullScreenshot.image,
            info: {
              selector,
              originalWidth: fullScreenshot.width,
              originalHeight: fullScreenshot.height,
              resizedWidth: fullScreenshot.width,
              resizedHeight: fullScreenshot.height,
            },
          });
        } catch (fallbackErr: unknown) {
          return err({
            code: "tool_script_error",
            message: `Video fallback failed: ${e instanceof Error ? e.message : String(e)} | Screenshot fallback failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
          });
        }
      }
    }

    return err({ code: "tool_script_error", message: result.error });
  }

  try {
    const image = await fetchAndResizeImage(result.src, maxWidth);
    const resized = calculateResizedDimensions(result.width, result.height, maxWidth);

    return ok({
      image,
      info: {
        selector,
        originalWidth: result.width || 0,
        originalHeight: result.height || 0,
        resizedWidth: resized.width,
        resizedHeight: resized.height,
      },
    });
  } catch (e: unknown) {
    log.error("Image extraction failed", e);
    return err({
      code: "tool_script_error",
      message: `Failed to extract image: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

async function fetchAndResizeImage(
  src: string,
  maxWidth: number,
): Promise<ExtractImageResult["image"]> {
  let blob: Blob;

  if (src.startsWith("data:")) {
    const response = await fetch(src);
    blob = await response.blob();
  } else {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    blob = await response.blob();
  }

  const img = await createImageBitmap(blob);
  const resized = calculateResizedDimensions(img.width, img.height, maxWidth);

  const canvas = new OffscreenCanvas(resized.width, resized.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  ctx.drawImage(img, 0, 0, resized.width, resized.height);

  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  const base64 = await blobToBase64(outBlob);

  return {
    type: "image",
    source: {
      type: "base64",
      base64,
      media_type: "image/png",
    },
  };
}

async function captureAndCropVideoFallback(
  browser: BrowserExecutor,
  rect: VideoFallbackInfo,
  maxWidth: number,
): Promise<{ image: ExtractImageResult["image"]; width: number; height: number }> {
  const screenshotDataUrl = await browser.captureScreenshot();
  const screenshotBlob = await (await fetch(screenshotDataUrl)).blob();
  const screenshotBitmap = await createImageBitmap(screenshotBlob);

  const scaleX = screenshotBitmap.width / Math.max(1, rect.viewportWidth);
  const scaleY = screenshotBitmap.height / Math.max(1, rect.viewportHeight);

  const sx = Math.max(0, Math.floor(rect.x * scaleX));
  const sy = Math.max(0, Math.floor(rect.y * scaleY));
  const sw = Math.max(1, Math.floor(rect.width * scaleX));
  const sh = Math.max(1, Math.floor(rect.height * scaleY));

  const clampedW = Math.min(sw, screenshotBitmap.width - sx);
  const clampedH = Math.min(sh, screenshotBitmap.height - sy);
  if (clampedW <= 0 || clampedH <= 0) {
    throw new Error("Video element is outside visible viewport");
  }

  const resized = calculateResizedDimensions(clampedW, clampedH, maxWidth);
  const canvas = new OffscreenCanvas(resized.width, resized.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  ctx.drawImage(screenshotBitmap, sx, sy, clampedW, clampedH, 0, 0, resized.width, resized.height);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const base64 = await blobToBase64(blob);

  return {
    image: {
      type: "image",
      source: {
        type: "base64",
        base64,
        media_type: "image/png",
      },
    },
    width: resized.width,
    height: resized.height,
  };
}

async function captureAndResizeScreenshot(
  browser: BrowserExecutor,
  maxWidth: number,
): Promise<{ image: ExtractImageResult["image"]; width: number; height: number }> {
  const screenshotDataUrl = await browser.captureScreenshot();
  const screenshotBlob = await (await fetch(screenshotDataUrl)).blob();
  const bitmap = await createImageBitmap(screenshotBlob);
  const resized = calculateResizedDimensions(bitmap.width, bitmap.height, maxWidth);

  const canvas = new OffscreenCanvas(resized.width, resized.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, resized.width, resized.height);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  const base64 = await blobToBase64(blob);

  return {
    image: {
      type: "image",
      source: {
        type: "base64",
        base64,
        media_type: "image/png",
      },
    },
    width: resized.width,
    height: resized.height,
  };
}

function calculateResizedDimensions(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (!width || !height) {
    return { width: maxWidth, height: maxWidth };
  }
  if (width <= maxWidth) {
    return { width, height };
  }
  return { width: maxWidth, height: Math.round(height * (maxWidth / width)) };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") {
        reject(new Error("Failed to read blob as data URL"));
        return;
      }
      resolve(value.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}
