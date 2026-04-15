import { createLogger } from "./logger";

const log = createLogger("port");

export interface AcquireLockMessage {
  type: "acquireLock";
  sessionId: string;
  windowId: number;
}

export interface LockResultMessage {
  type: "lockResult";
  sessionId: string;
  success: boolean;
  ownerWindowId?: number;
}

export interface GetLockedSessionsMessage {
  type: "getLockedSessions";
}

export interface LockedSessionsMessage {
  type: "lockedSessions";
  locks: Record<string, number>;
}

export type SidepanelMessage = AcquireLockMessage | GetLockedSessionsMessage;
export type BackgroundMessage = LockResultMessage | LockedSessionsMessage;

type ResponseType = {
  acquireLock: LockResultMessage;
  getLockedSessions: LockedSessionsMessage;
};

const RESPONSE_TYPE_MAP: Record<SidepanelMessage["type"], BackgroundMessage["type"]> = {
  acquireLock: "lockResult",
  getLockedSessions: "lockedSessions",
};

let port: chrome.runtime.Port | null = null;
let currentWindowId: number | undefined;
const responseHandlers = new Map<string, (msg: BackgroundMessage) => void>();

export async function initialize(windowId: number): Promise<void> {
  currentWindowId = windowId;
  try {
    await connect();
  } catch {
    log.warn("初回接続失敗 — sendMessage 時にリトライします");
  }
}

async function connect(): Promise<chrome.runtime.Port> {
  if (!currentWindowId) throw new Error("windowId not initialized");

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      log.debug("接続中...");
      const p = chrome.runtime.connect({ name: `sidepanel:${currentWindowId}` });

      const connected = await new Promise<boolean>((resolve) => {
        let resolved = false;
        p.onDisconnect.addListener(() => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
          port = null;
        });
        p.onMessage.addListener((msg: BackgroundMessage) => {
          const handler = responseHandlers.get(msg.type);
          if (handler) handler(msg);
        });
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        }, 100);
      });

      if (connected) {
        port = p;
        return p;
      }
    } catch {}

    const delay = 200 * (attempt + 1);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error("Background への接続に失敗しました");
}

export async function sendMessage<T extends SidepanelMessage>(
  message: T,
  timeoutMs = 5000,
): Promise<ResponseType[T["type"]]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (!port) await connect();

    try {
      const responseType = RESPONSE_TYPE_MAP[message.type];

      const responsePromise = new Promise<BackgroundMessage>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          responseHandlers.delete(responseType);
          reject(new Error(`Timeout: ${responseType}`));
        }, timeoutMs);

        responseHandlers.set(responseType, (msg) => {
          clearTimeout(timeoutId);
          responseHandlers.delete(responseType);
          resolve(msg);
        });
      });

      port!.postMessage(message);
      return (await responsePromise) as ResponseType[T["type"]];
    } catch (e) {
      responseHandlers.delete(RESPONSE_TYPE_MAP[message.type]);
      if (attempt === 2) throw new Error(`Port 通信失敗: ${e}`);
      log.warn("リトライ...", e);
      port = null;
    }
  }

  throw new Error("Port 通信失敗");
}

export function isConnected(): boolean {
  return port !== null;
}
