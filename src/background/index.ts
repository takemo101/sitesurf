import { createLogger } from "@/shared/logger";
import type { SidepanelMessage, LockResultMessage, LockedSessionsMessage } from "@/shared/port";
import { ChromeBrowserExecutor } from "@/adapters/chrome/chrome-browser-executor";
import { acquireLock, releaseLocksForWindow } from "./handlers/session-lock";
import { addOpenPanel, removeOpenPanel } from "./handlers/panel-tracker";
import { initWire, sendPing } from "./handlers/wire";
import "./handlers/native-input";
import "./handlers/bg-fetch";

const log = createLogger("background");
const browserExecutor = new ChromeBrowserExecutor();
const initWireWithBrowser = () => initWire(browserExecutor);

chrome.runtime.onConnect.addListener((port) => {
  const match = /^sidepanel:(\d+)$/.exec(port.name);
  if (!match) return;
  const windowId = Number(match[1]);
  addOpenPanel(windowId);

  port.onMessage.addListener(async (msg: SidepanelMessage) => {
    log.debug("Port メッセージ受信", { type: msg.type });

    if (msg.type === "acquireLock") {
      const result = await acquireLock(msg.sessionId, msg.windowId);
      const response: LockResultMessage = {
        type: "lockResult",
        sessionId: msg.sessionId,
        success: result.success,
        ownerWindowId: result.ownerWindowId,
      };
      port.postMessage(response);
    } else if (msg.type === "getLockedSessions") {
      const result = await getLockedSessions();
      const response: LockedSessionsMessage = { type: "lockedSessions", locks: result };
      port.postMessage(response);
    }
  });

  port.onDisconnect.addListener(() => {
    removeOpenPanel(windowId);
    releaseLocksForWindow(windowId);
  });
});

async function getLockedSessions(): Promise<Record<string, number>> {
  const data = await chrome.storage.session.get("session_locks");
  return (data.session_locks as Record<string, number>) ?? {};
}

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-sidepanel" && tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  releaseLocksForWindow(windowId);
});

// MCP Server接続の初期化（設定を読み込んで接続）
initWireWithBrowser();
chrome.runtime.onStartup.addListener(initWireWithBrowser);
chrome.runtime.onInstalled.addListener(initWireWithBrowser);

chrome.alarms.create("wire-keep-alive", { periodInMinutes: 25 / 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "wire-keep-alive") sendPing();
});
