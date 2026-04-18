import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";
import type { BgFetchMessage, BgFetchResponse } from "@/shared/message-types";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_MS = 1_000;
const ALLOWED_RESPONSE_TYPES = new Set(["text", "json", "base64", "readability"]);

interface SandboxFetchArgs {
  url: unknown;
  method?: unknown;
  headers?: unknown;
  body?: unknown;
  responseType?: unknown;
  timeout?: unknown;
}

/**
 * FetchProvider - REPL sandbox 内から CORS 制約なしに任意 URL を fetch するための
 * `sandboxFetch(url, options?)` ヘルパを提供する。
 *
 * 実体は bg_fetch (background 側の fetchOneWithBgInfra) に委譲する。
 * top-level bg_fetch との違い：
 * - 結果が AI の conversation history を経由せず、repl の戻り値や artifact に
 *   直接書き出せる（トークン効率が大きい）
 * - for ループで並列／連続取得を 1 ツールコール内に畳める（MAX_TURNS 節約）
 */
export class FetchProvider implements RuntimeProvider {
  readonly actions = ["sandboxFetch"] as const;

  getDescription(): string {
    return `## sandboxFetch(url, options?) — REPL 内で任意 URL を fetch

外部 URL を background service worker 経由で取得する。CORS 制約なし、
アクティブタブを汚さず、結果は AI のコンテキストを経由せず repl 戻り値や
artifact に直接渡せる（トークン効率◎）。

### When to Use
- 5 URL 以上の並列／連続取得
- 結果を \`createOrUpdateArtifact()\` に保存したいとき
- JSON API / GitHub raw / 静的ドキュメント

### Do NOT Use For
- 1〜2 URL だけ取得して AI が直接内容を読みたい場合 → top-level \`bg_fetch\` を使う
- SPA/CSR サイト → \`navigate()\` + \`browserjs()\` を使う（sandboxFetch も JS 実行後の内容は取れない）

### Signature

\`\`\`ts
sandboxFetch(url: string, options?: {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
  headers?: Record<string, string>,
  body?: string,
  responseType?: "text" | "json" | "base64" | "readability",  // default: "text"
  timeout?: number,                                             // ms, default 30000, max 60000
}): Promise<{
  url: string,
  ok: boolean,
  status: number,
  statusText: string,
  headers: Record<string, string>,
  body: string | object,
  redirected?: boolean,
  redirectUrl?: string,
}>
\`\`\`

\`\`\`javascript
// ✅ 多 URL を 1 ツールコールで畳む
const contents = {};
for (const url of urls) {
  try {
    const { body } = await sandboxFetch(url, { responseType: 'readability' });
    contents[url] = body.content;
  } catch (e) {
    contents[url] = 'Error: ' + e.message;
  }
}
await createOrUpdateArtifact('docs.json', contents);
return \`Collected \${Object.keys(contents).length} pages\`;
\`\`\``;
  }

  getRuntimeCode(): string {
    return `
async function sandboxFetch(url, options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const handler = (event) => {
      if (event.data && event.data.type === 'sandbox-response' && event.data.id === id) {
        window.removeEventListener('message', handler);
        if (event.data.ok) {
          resolve(event.data.value);
        } else {
          reject(new Error(event.data.error));
        }
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({
      type: 'sandbox-request',
      id,
      action: 'sandboxFetch',
      url,
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      responseType: opts.responseType,
      timeout: opts.timeout,
    }, '*');
  });
}`;
  }

  async handleRequest(
    request: SandboxRequest,
    _context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { url, method, headers, body, responseType, timeout } =
      request as unknown as SandboxFetchArgs;

    if (typeof url !== "string" || url.length === 0) {
      return err({ code: "tool_script_error", message: "sandboxFetch: url is required" });
    }

    const message: BgFetchMessage = {
      type: "BG_FETCH",
      url,
      method: typeof method === "string" ? method : "GET",
      headers:
        headers && typeof headers === "object" && !Array.isArray(headers)
          ? (headers as Record<string, string>)
          : undefined,
      body: typeof body === "string" ? body : undefined,
      responseType:
        typeof responseType === "string" && ALLOWED_RESPONSE_TYPES.has(responseType)
          ? (responseType as BgFetchMessage["responseType"])
          : "text",
      timeout:
        typeof timeout === "number"
          ? Math.min(Math.max(timeout, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
          : DEFAULT_TIMEOUT_MS,
    };

    try {
      const result = await chrome.runtime.sendMessage<BgFetchMessage, BgFetchResponse>(message);

      if (!result?.success || !result.data) {
        return err({
          code: "tool_script_error",
          message: result?.error ?? "sandboxFetch: no response from background handler",
        });
      }

      return ok(result.data);
    } catch (e: unknown) {
      return err({
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
