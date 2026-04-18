import type {
  BgFetchMessage,
  BgFetchResponse,
  ReadabilityMessage,
  ReadabilityResponse,
} from "@/shared/message-types";

// --- Constants ---

const MAX_URL_LENGTH = 2000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_REDIRECTS = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 100;
const BLOCKED_PROTOCOLS = ["chrome:", "chrome-extension:", "file:", "data:", "javascript:"];
const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0", "[::1]", "metadata.google.internal"]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const BLOCKED_HEADERS = new Set(["host", "origin", "cookie", "set-cookie", "proxy-authorization"]);

// --- Semaphore ---

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

const fetchSemaphore = new Semaphore(10);

// --- Cache ---

interface CacheEntry {
  data: BgFetchResponse["data"];
  expires: number;
  insertedAt: number;
}

const cache = new Map<string, CacheEntry>();

function buildCacheKey(url: string, responseType: string): string {
  return `${responseType}:${url}`;
}

function getFromCache(key: string): BgFetchResponse["data"] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: BgFetchResponse["data"]): void {
  // Purge expired entries
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now > v.expires) cache.delete(k);
  }

  // Evict oldest if still at capacity
  if (cache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of cache) {
      if (v.insertedAt < oldestTime) {
        oldestTime = v.insertedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }

  cache.set(key, { data, expires: now + CACHE_TTL, insertedAt: now });
}

// --- URL Validation ---

function isPrivateIp(hostname: string): boolean {
  // IPv6 loopback
  if (hostname === "::1" || hostname === "[::1]") return true;

  // Strip IPv6 brackets
  const h = hostname.replace(/^\[|\]$/g, "");

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(h);
  const ipStr = v4Mapped ? v4Mapped[1]! : h;

  // Parse IPv4 octets
  const parts = ipStr.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets as [number, number, number, number];

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  // Private: 10.0.0.0/8
  if (a === 10) return true;
  // Private: 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // Private: 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // Link-local: 169.254.0.0/16 (includes AWS/GCP metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  return false;
}

function validateUrl(url: string): { valid: boolean; error?: string } {
  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: `URL exceeds maximum length of ${MAX_URL_LENGTH}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  // Protocol check
  if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, error: `Blocked protocol: ${parsed.protocol}` };
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: `Unsupported protocol: ${parsed.protocol}` };
  }

  // Host check
  if (BLOCKED_HOSTS.has(parsed.hostname)) {
    return { valid: false, error: `Blocked host: ${parsed.hostname}` };
  }

  // Private/internal IP check
  if (isPrivateIp(parsed.hostname)) {
    return { valid: false, error: `Blocked: private/internal IP address` };
  }

  // Credentials check
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with credentials are not allowed" };
  }

  return { valid: true };
}

function upgradeToHttps(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
      return parsed.toString();
    }
  } catch {
    // return as-is
  }
  return url;
}

// --- Input Validation ---

function sanitizeMethod(method: string): string {
  const upper = method.toUpperCase();
  if (!ALLOWED_METHODS.has(upper)) {
    throw new Error(`Blocked HTTP method: ${method}`);
  }
  return upper;
}

function sanitizeHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof key !== "string" || typeof value !== "string") continue;
    if (BLOCKED_HEADERS.has(key.toLowerCase())) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

// --- Redirect ---

function isPermittedRedirect(originalUrl: string, redirectUrl: string): boolean {
  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);

    // Allow same protocol or http→https upgrade
    if (redirect.protocol !== original.protocol) {
      if (!(original.protocol === "http:" && redirect.protocol === "https:")) {
        return false;
      }
    }

    if (redirect.username || redirect.password) return false;

    // Compare effective ports (handle default port omission)
    const effectivePort = (u: URL) => u.port || (u.protocol === "https:" ? "443" : "80");
    if (effectivePort(original) !== effectivePort(redirect)) return false;

    const stripWww = (h: string) => h.replace(/^www\./, "");
    return stripWww(original.hostname) === stripWww(redirect.hostname);
  } catch {
    return false;
  }
}

interface RedirectInfo {
  redirected: true;
  redirectUrl: string;
  status: number;
}

async function fetchWithRedirects(
  url: string,
  init: RequestInit,
  timeout: number,
  depth = 0,
): Promise<Response | RedirectInfo> {
  if (depth > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (exceeded ${MAX_REDIRECTS})`);
  }

  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
  });

  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect missing Location header");

    const redirectUrl = new URL(location, url).toString();

    // Validate redirect target against security rules
    const validation = validateUrl(redirectUrl);
    if (!validation.valid) {
      throw new Error(`Redirect blocked: ${validation.error} (${redirectUrl})`);
    }

    if (isPermittedRedirect(url, redirectUrl)) {
      return fetchWithRedirects(redirectUrl, init, timeout, depth + 1);
    }

    return { redirected: true, redirectUrl, status: response.status };
  }

  return response;
}

// --- Readability via offscreen ---

// Singleton promise to prevent concurrent createDocument calls
let offscreenPromise: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenPromise) return offscreenPromise;

  offscreenPromise = (async () => {
    try {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (!hasDoc) {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: [chrome.offscreen.Reason.DOM_PARSER],
          justification: "Parse HTML and extract main content with Readability",
        });
      }
    } catch {
      offscreenPromise = null;
      throw new Error("Failed to create offscreen document");
    }
  })();

  return offscreenPromise;
}

async function closeOffscreenDocument(): Promise<void> {
  offscreenPromise = null;
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // Already closed or never created
  }
}

async function extractWithReadability(
  html: string,
  url: string,
): Promise<{ title: string; content: string; links: Array<{ text: string; href: string }> }> {
  await ensureOffscreenDocument();

  try {
    const result = await chrome.runtime.sendMessage<ReadabilityMessage, ReadabilityResponse>({
      type: "BG_READABILITY",
      html,
      url,
    });

    if (!result?.success) {
      throw new Error(result?.error ?? "Readability extraction failed");
    }

    return {
      title: result.title ?? "",
      content: result.content ?? "",
      links: result.links ?? [],
    };
  } finally {
    // Close offscreen document after use to avoid message routing conflicts
    // (CRITICAL-1: offscreen's onMessage listener interferes with other sendMessage calls)
    await closeOffscreenDocument();
  }
}

// --- Response conversion ---

function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

async function convertResponse(
  response: Response,
  responseType: BgFetchMessage["responseType"],
  url: string,
): Promise<BgFetchResponse["data"]> {
  const base = {
    url,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: extractHeaders(response),
  };

  // Check size via Content-Length hint
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
    throw new Error(`Response too large: ${contentLength} bytes (max ${MAX_RESPONSE_SIZE})`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_SIZE) {
    throw new Error(`Response too large: ${buffer.byteLength} bytes (max ${MAX_RESPONSE_SIZE})`);
  }

  switch (responseType) {
    case "json": {
      const text = new TextDecoder().decode(buffer);
      try {
        return { ...base, body: JSON.parse(text) };
      } catch {
        throw new Error("Invalid JSON response");
      }
    }

    case "base64": {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return { ...base, body: btoa(binary) };
    }

    case "readability": {
      const html = new TextDecoder().decode(buffer);
      const extracted = await extractWithReadability(html, url);
      return { ...base, body: extracted };
    }

    case "text":
    default: {
      return { ...base, body: new TextDecoder().decode(buffer) };
    }
  }
}

// --- Main handler ---

/**
 * 1 URL 分の fetch を background 側インフラ (semaphore / cache / redirect /
 * offscreen readability) を通して実行する。
 *
 * 通常は chrome.runtime onMessage 経由で呼ばれるが、同一プロセスからの
 * 直接呼び出しもサポートする（FetchProvider / テスト用途）。
 */
export async function fetchOneWithBgInfra(msg: BgFetchMessage): Promise<BgFetchResponse> {
  // Validate method
  let method: string;
  try {
    method = sanitizeMethod(msg.method);
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Validate URL
  const validation = validateUrl(msg.url);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const url = upgradeToHttps(msg.url);
  const headers = sanitizeHeaders(msg.headers);

  // Cache check (GET only, keyed by url + responseType)
  const cacheKey = buildCacheKey(url, msg.responseType);
  if (method === "GET") {
    const cached = getFromCache(cacheKey);
    if (cached) return { success: true, data: cached };
  }

  await fetchSemaphore.acquire();
  try {
    const init: RequestInit = {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : msg.body,
    };

    const result = await fetchWithRedirects(url, init, msg.timeout);

    // Cross-host redirect
    if ("redirected" in result && !(result instanceof Response)) {
      return {
        success: true,
        data: {
          url,
          ok: false,
          status: result.status,
          statusText: "Redirect",
          headers: {},
          body: "",
          redirected: true,
          redirectUrl: result.redirectUrl,
        },
      };
    }

    const data = await convertResponse(result as Response, msg.responseType, url);

    // Cache GET responses
    if (method === "GET") {
      setCache(cacheKey, data);
    }

    return { success: true, data };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  } finally {
    fetchSemaphore.release();
  }
}

// --- Message handler registration ---

chrome.runtime.onMessage.addListener(
  (
    msg: { type?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BgFetchResponse) => void,
  ) => {
    if (msg.type === "BG_FETCH") {
      fetchOneWithBgInfra(msg as BgFetchMessage)
        .then(sendResponse)
        .catch((err) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      return true; // async
    }
  },
);
