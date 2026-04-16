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

interface BgFetchArgs {
  urls: string[];
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  response_type?: "text" | "json" | "base64" | "readability";
  timeout?: number;
}

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

export async function executeBgFetch(
  args: Record<string, unknown>,
): Promise<Result<BgFetchResultItem | BgFetchResultItem[], ToolError>> {
  const { urls, method, headers, body, response_type, timeout } = args as unknown as BgFetchArgs;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return err({ code: "tool_script_error", message: "urls must be a non-empty array" });
  }
  if (urls.length > MAX_URLS) {
    return err({ code: "tool_script_error", message: `Maximum ${MAX_URLS} URLs per request` });
  }

  const fetchOne = async (url: string): Promise<BgFetchResultItem> => {
    try {
      const message: BgFetchMessage = {
        type: "BG_FETCH",
        url,
        method: method ?? "GET",
        headers,
        body,
        responseType: response_type ?? "text",
        timeout: Math.min(timeout ?? 30000, 60000),
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
          error: result?.error ?? "bgFetch failed",
        };
      }

      const data = result.data;
      if (typeof data.body === "string" && data.body.length > MAX_BODY_CHARS) {
        data.body = data.body.substring(0, MAX_BODY_CHARS) + "\n... (truncated)";
      }

      return { ...data, url };
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
