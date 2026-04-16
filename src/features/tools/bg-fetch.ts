import type { ToolDefinition } from "@/ports/ai-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";
import type { BgFetchMessage, BgFetchResponse } from "@/shared/message-types";

const MAX_URLS = 20;
const MAX_BODY_CHARS = 50_000;

export const bgFetchToolDef: ToolDefinition = {
  name: "bg_fetch",
  description:
    "外部URLのコンテンツを取得する。CORSを回避してあらゆるURLにアクセス可能。" +
    "複数URLを並列取得できる。Webページはresponse_type='readability'で本文のみ抽出すると効率的。" +
    "readabilityモードでは本文テキストに加え、ページ内リンク一覧も返すのでドキュメント探索に活用できる。",
  parameters: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: { type: "string" },
        description: "取得するURLのリスト",
      },
      method: {
        type: "string",
        description: "HTTPメソッド（default: GET）",
      },
      headers: {
        type: "object",
        description: "リクエストヘッダー",
      },
      body: {
        type: "string",
        description: "リクエストボディ",
      },
      response_type: {
        type: "string",
        enum: ["text", "json", "base64", "readability"],
        description:
          "レスポンス形式。text=生テキスト, json=JSONパース, base64=バイナリ, " +
          "readability=HTMLから本文+リンク一覧を抽出（Webページに推奨）",
      },
      timeout: {
        type: "number",
        description: "タイムアウトms（default: 30000, max: 60000）",
      },
    },
    required: ["urls"],
  },
};

interface BgFetchResultItem {
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | object;
  redirected?: boolean;
  redirectUrl?: string;
  error?: string;
}

function truncateBody(body: string | object): string | object {
  if (typeof body === "string") {
    return body.length > MAX_BODY_CHARS
      ? body.substring(0, MAX_BODY_CHARS) + "\n... (truncated)"
      : body;
  }

  // Handle readability body { title, content, links }
  if (typeof body === "object" && body !== null && "content" in body) {
    const rb = body as { title: string; content: string; links: unknown[] };
    if (rb.content.length > MAX_BODY_CHARS) {
      return { ...rb, content: rb.content.substring(0, MAX_BODY_CHARS) + "\n... (truncated)" };
    }
  }

  return body;
}

export async function executeBgFetch(
  args: Record<string, unknown>,
): Promise<Result<BgFetchResultItem | BgFetchResultItem[], ToolError>> {
  // Runtime input validation
  const urls = args.urls;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return err({ code: "tool_script_error", message: "urls must be a non-empty array" });
  }
  if (urls.length > MAX_URLS) {
    return err({ code: "tool_script_error", message: `Maximum ${MAX_URLS} URLs per request` });
  }
  if (urls.some((u) => typeof u !== "string")) {
    return err({ code: "tool_script_error", message: "All urls must be strings" });
  }

  const method = typeof args.method === "string" ? args.method : "GET";
  const headers =
    args.headers && typeof args.headers === "object" && !Array.isArray(args.headers)
      ? (args.headers as Record<string, string>)
      : undefined;
  const body = typeof args.body === "string" ? args.body : undefined;
  const responseType =
    typeof args.response_type === "string" &&
    ["text", "json", "base64", "readability"].includes(args.response_type)
      ? (args.response_type as BgFetchMessage["responseType"])
      : "text";
  const timeout =
    typeof args.timeout === "number" ? Math.min(Math.max(args.timeout, 1000), 60000) : 30000;

  const fetchOne = async (url: string): Promise<BgFetchResultItem> => {
    try {
      const message: BgFetchMessage = {
        type: "BG_FETCH",
        url,
        method,
        headers,
        body,
        responseType,
        timeout,
      };

      const result = await chrome.runtime.sendMessage<BgFetchMessage, BgFetchResponse>(message);

      if (!result?.success || !result.data) {
        return {
          url,
          ok: false,
          status: 0,
          statusText: "",
          headers: {},
          body: "",
          error: result?.error ?? "bgFetch: no response from background handler",
        };
      }

      return { ...result.data, url, body: truncateBody(result.data.body) };
    } catch (e: unknown) {
      return {
        url,
        ok: false,
        status: 0,
        statusText: "",
        headers: {},
        body: "",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  const results = await Promise.all(urls.map(fetchOne));

  if (results.length === 1) {
    const item = results[0]!;
    if (!item.ok && item.error) {
      return err({ code: "tool_script_error", message: `${item.url}: ${item.error}` });
    }
    return ok(item);
  }

  return ok(results);
}
