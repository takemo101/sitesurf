#!/usr/bin/env npx tsx
import { Cli, z } from "incur";
import { ChromeBridge } from "./bridge.js";

const PORT = parseInt(process.env.TANDEMWEB_PORT || "7331");
const bridge = new ChromeBridge(PORT);

let bridgeStarted = false;
async function ensureBridge(): Promise<void> {
  if (bridgeStarted) return;
  bridgeStarted = true;
  await bridge.start();
}

const cli = Cli.create("sitesurf", {
  description: "Browser automation via SiteSurf Chrome extension",
  version: "0.1.0",
})
  .command("tabs-list", {
    description: "List all open tabs",
    async run() {
      await ensureBridge();
      return bridge.send("tabs_list");
    },
  })
  .command("tab-create", {
    description: "Create a new tab",
    options: z.object({
      url: z.string().default("about:blank").describe("URL to open"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("tab_create", { url: c.options.url });
    },
  })
  .command("tab-navigate", {
    description: "Navigate a tab to a URL",
    args: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
    }),
    options: z.object({
      url: z.string().describe("URL to navigate to"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("tab_navigate", { tabId: c.args.tabId, url: c.options.url });
    },
  })
  .command("tab-close", {
    description: "Close a tab",
    args: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("tab_close", { tabId: c.args.tabId });
    },
  })
  .command("tab-switch", {
    description: "Switch to a tab",
    args: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("tab_switch", { tabId: c.args.tabId });
    },
  })
  .command("page-read", {
    description: "Read page content (text and simplified DOM)",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_read", { tabId: c.options.tabId });
    },
  })
  .command("page-click", {
    description: "Click an element by CSS selector or coordinates",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
      selector: z.string().optional().describe("CSS selector"),
      x: z.coerce.number().optional().describe("X coordinate"),
      y: z.coerce.number().optional().describe("Y coordinate"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_click", {
        tabId: c.options.tabId,
        selector: c.options.selector,
        x: c.options.x,
        y: c.options.y,
      });
    },
  })
  .command("page-type", {
    description: "Type text into an element",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
      text: z.string().describe("Text to type"),
      selector: z.string().optional().describe("CSS selector (default: focused element)"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_type", {
        tabId: c.options.tabId,
        text: c.options.text,
        selector: c.options.selector,
      });
    },
  })
  .command("page-eval", {
    description: "Execute JavaScript in the page context",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
      code: z.string().describe("JavaScript code to execute"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_eval", { tabId: c.options.tabId, code: c.options.code });
    },
  })
  .command("screenshot", {
    description: "Capture a screenshot of the visible tab area",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_screenshot", { tabId: c.options.tabId });
    },
  })
  .command("page-pick-element", {
    description: "Open visual picker and select an element",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
      message: z.string().optional().describe("Banner message shown in page"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_pick_element", {
        tabId: c.options.tabId,
        message: c.options.message,
      });
    },
  })
  .command("page-extract-image", {
    description: "Extract image/video frame by CSS selector",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
      selector: z.string().describe("CSS selector"),
      maxWidth: z.coerce.number().optional().describe("Resize width (default 800)"),
    }),
    async run(c) {
      await ensureBridge();
      return bridge.send("page_extract_image", {
        tabId: c.options.tabId,
        selector: c.options.selector,
        maxWidth: c.options.maxWidth,
      });
    },
  });

cli.serve();
