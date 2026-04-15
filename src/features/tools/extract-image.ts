import type { ToolDefinition } from "@/ports/ai-provider";
export { executeExtractImage, type ExtractImageResult } from "@/shared/extract-image-core";

export const extractImageToolDef: ToolDefinition = {
  name: "extract_image",
  description: `Extract images from the current page. Returns image data that you can see and analyze.

Supported elements:
- img tags
- canvas tags (may fail if CORS-tainted)
- Elements with background-image CSS
- video tags (captures current frame; falls back to screenshot crop if direct capture is blocked)

Parameters:
- selector: CSS selector for the image element (e.g., "img.hero", "#logo", "canvas#main", "video")`,
  parameters: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        description: "CSS selector for the image element",
      },
      maxWidth: {
        type: "number",
        description: "Max width to resize image to (default 800). Reduces token usage.",
        default: 800,
      },
    },
    required: ["selector"],
  },
};
