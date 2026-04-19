import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";
import { buildBgFetchHelperDescription } from "@/shared/repl-description-sections";
import type { BgFetchMessage, BgFetchResponse } from "@/shared/message-types";
import { useStore } from "@/store/index";

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
 * `bgFetch(url, options?)` ヘルパを提供する。
 *
 * 実体は bg_fetch (background 側の fetchOneWithBgInfra) に委譲する。
 * top-level bg_fetch との違い：
 * - 結果が AI の conversation history を経由せず、repl の戻り値や artifact に
 *   直接書き出せる（トークン効率が大きい）
 * - for ループで並列／連続取得を 1 ツールコール内に畳める（MAX_TURNS 節約）
 */
export class FetchProvider implements RuntimeProvider {
  readonly actions = ["bgFetch"] as const;

  getDescription(): string {
    return buildBgFetchHelperDescription();
  }

  async handleRequest(
    request: SandboxRequest,
    _context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { url, method, headers, body, responseType, timeout } =
      request as unknown as SandboxFetchArgs;

    if (typeof url !== "string" || url.length === 0) {
      return err({ code: "tool_script_error", message: "bgFetch: url is required" });
    }

    // 設定側の enableBgFetch ゲートを尊重する。top-level bg_fetch と同じ
    // 判定を通して、REPL 経由の bgFetch が設定の抜け道にならないようにする。
    if (!useStore.getState().settings.enableBgFetch) {
      return err({
        code: "tool_script_error",
        message: "bgFetch is disabled in settings (enableBgFetch is off)",
      });
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
          message: result?.error ?? "bgFetch: no response from background handler",
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
