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
const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"];

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

const cache = new Map<string, { data: BgFetchResponse["data"]; expires: number }>();

function getFromCache(url: string): BgFetchResponse["data"] | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

function setCache(url: string, data: BgFetchResponse["data"]): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expires) cache.delete(k);
    }
  }
  cache.set(url, { data, expires: Date.now() + CACHE_TTL });
}

// --- URL Validation ---

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

  for (const proto of BLOCKED_PROTOCOLS) {
    if (parsed.protocol === proto || parsed.protocol === `${proto}//`) {
      return { valid: false, error: `Blocked protocol: ${parsed.protocol}` };
    }
  }

  if (BLOCKED_HOSTS.includes(parsed.hostname)) {
    return { valid: false, error: `Blocked host: ${parsed.hostname}` };
  }

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

// --- Redirect ---

function isPermittedRedirect(originalUrl: string, redirectUrl: string): boolean {
  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);

    if (redirect.protocol !== original.protocol) return false;
    if (redirect.port !== original.port) return false;
    if (redirect.username || redirect.password) return false;

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

    if (isPermittedRedirect(url, redirectUrl)) {
      return fetchWithRedirects(redirectUrl, init, timeout, depth + 1);
    }

    return { redirected: true, redirectUrl, status: response.status };
  }

  return response;
}

// --- Readability via offscreen ---

async function extractWithReadability(
  html: string,
  url: string,
): Promise<{ title: string; content: string; links: Array<{ text: string; href: string }> }> {
  const hasDoc = await chrome.offscreen.hasDocument();
  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Parse HTML and extract main content with Readability",
    });
  }

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

async function handleBgFetch(msg: BgFetchMessage): Promise<BgFetchResponse> {
  const validation = validateUrl(msg.url);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const url = upgradeToHttps(msg.url);

  // Cache check (GET only)
  if (msg.method === "GET") {
    const cached = getFromCache(url);
    if (cached) return { success: true, data: cached };
  }

  await fetchSemaphore.acquire();
  try {
    const init: RequestInit = {
      method: msg.method,
      headers: msg.headers,
      body: msg.body,
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
    if (msg.method === "GET") {
      setCache(url, data);
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
  (msg: BgFetchMessage, _sender, sendResponse: (response: BgFetchResponse) => void) => {
    if (msg.type === "BG_FETCH") {
      handleBgFetch(msg)
        .then(sendResponse)
        .catch((err) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      return true; // async
    }
    return false;
  },
);
