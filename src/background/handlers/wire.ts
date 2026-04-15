import { createLogger } from "@/shared/logger";
import type { BrowserExecutor } from "@/ports/browser-executor";
import {
  handlePageClick,
  handlePageEval,
  handlePagePickElement,
  handlePageRead,
  handlePageScreenshot,
  handlePageType,
} from "./page-commands";
import { handlePageExtractImage } from "./page-extract-image";
import {
  handleTabClose,
  handleTabCreate,
  handleTabNavigate,
  handleTabsList,
  handleTabSwitch,
} from "./tab-commands";

const log = createLogger("wire");

const WS_URL = "ws://localhost:7331";
const RECONNECT_INTERVAL_MS = 3000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setInterval> | null = null;
let browser: BrowserExecutor | null = null;

function getBrowser(): BrowserExecutor {
  if (!browser) {
    throw new Error("wire browser executor is not initialized");
  }
  return browser;
}

// 設定を読み込む
async function loadMcpServerSetting(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(["sitesurf_settings", "tandemweb_settings"]);
    const settings = (result.sitesurf_settings ?? result.tandemweb_settings) as
      | { enableMcpServer?: boolean }
      | undefined;
    return settings?.enableMcpServer ?? false;
  } catch {
    return false;
  }
}

export async function initWire(injectedBrowser?: BrowserExecutor): Promise<void> {
  if (injectedBrowser) {
    browser = injectedBrowser;
  }

  const isEnabled = await loadMcpServerSetting();

  if (!isEnabled) {
    log.debug("MCP Server は無効化されています");
    return;
  }

  connectWire();
}

export function connectWire(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    log.info("MCP Server に接続");
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = async (event) => {
    let msg: { id: string; method: string; params?: Record<string, unknown> };
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    try {
      const result = await handleCommand(msg.method, msg.params ?? {});
      ws?.send(JSON.stringify({ id: msg.id, result }));
    } catch (err: unknown) {
      ws?.send(
        JSON.stringify({ id: msg.id, error: err instanceof Error ? err.message : String(err) }),
      );
    }
  };

  ws.onclose = () => {
    log.debug("切断");
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(connectWire, RECONNECT_INTERVAL_MS);
  }
}

export function sendPing(): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ id: "ping", method: "ping" }));
  } else {
    connectWire();
  }
}

async function handleCommand(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "tabs_list":
      return handleTabsList();
    case "tab_create": {
      return handleTabCreate(params, getBrowser());
    }
    case "tab_navigate": {
      return handleTabNavigate(params, getBrowser());
    }
    case "tab_close":
      return handleTabClose(params);
    case "tab_switch":
      return handleTabSwitch(params);
    case "page_read": {
      return handlePageRead(params, getBrowser());
    }
    case "page_click":
      return handlePageClick(params);
    case "page_type":
      return handlePageType(params);
    case "page_screenshot":
      return handlePageScreenshot(params, getBrowser());
    case "page_eval": {
      return handlePageEval(params, getBrowser());
    }
    case "page_pick_element": {
      return handlePagePickElement(params, getBrowser());
    }
    case "page_extract_image": {
      return handlePageExtractImage(params, getBrowser());
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
