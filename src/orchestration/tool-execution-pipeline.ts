import type { BrowserExecutor } from "@/ports/browser-executor";
import type { ToolExecutor } from "@/ports/tool-executor";
import type { AppError, Result } from "@/shared/errors";
import type { SecurityMiddleware } from "@/features/security/middleware";
import { createLogger } from "@/shared/logger";
import { defaultConsoleLogService, normalizeConsoleLogEntry } from "@/shared/console-log-types";
import { trackSpaDomainsFromBgFetch } from "./visited-url-tracker";

const log = createLogger("agent-loop");

/**
 * repl 実行時に `defaultConsoleLogService` に流し込む console-log hook 群を生成する。
 * pipeline に渡すコールバックが長くなるので呼び出し側の関数から切り出しておく。
 */
export function makeReplConsoleHooks(toolCallId: string): {
  onConsoleStart: () => void;
  onConsoleLog: (message: string) => void;
} {
  return {
    onConsoleStart: () => {
      defaultConsoleLogService.clear(toolCallId);
    },
    onConsoleLog: (message) => {
      const normalized = normalizeConsoleLogEntry(message);
      defaultConsoleLogService.append(toolCallId, {
        level: normalized.level,
        message: normalized.message,
        timestamp: normalized.timestamp,
      });
    },
  };
}

export interface ToolCallInput {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ExecuteToolArgs {
  toolCall: ToolCallInput;
  browser: BrowserExecutor;
  toolExecutor: ToolExecutor;
  securityMiddleware: SecurityMiddleware;
  securityEnabled: boolean;
  sessionId: string;
  /**
   * bg_fetch 結果から「以前 SPA と判定したドメインへの再取得」を検出するのに使う。
   * SPA 判定されたドメインはこの Set に in-place で追加される。
   */
  spaDetectedDomains: Set<string>;
  /** repl 限定: ツール実行開始時に呼ばれる（console log buffer のクリアに使う） */
  onConsoleStart?: () => void;
  /** repl 限定: ツール実行中の console.log を受け取る（"[LEVEL] message" 形式の文字列） */
  onConsoleLog?: (message: string) => void;
  /** Security middleware が怪しい出力を検出し、安全な要約に差し替えたときに呼ばれる */
  onSecurityBlocked?: () => void;
}

export interface ExecuteToolResult {
  /**
   * 表示 / 履歴用の Result<T, E>。Security middleware が差し替えた場合は
   * `toolResult.value` / `toolResult.error` も差し替え後の内容になっている。
   */
  toolResult: Result<unknown, AppError>;
  /**
   * API 履歴の `tool` メッセージ `result` に積む文字列。
   *
   * - Security middleware が検出した場合: securityAlert 要約 JSON
   * - 画像 (data:image/...) を含む場合: "[screenshot captured]"
   * - bg_fetch で既知 SPA ドメインを再訪した場合: 末尾に警告文が追記される
   */
  fullResult: string;
}

/**
 * 単一 tool call を実行する共通パイプライン。
 *
 * agent-loop からはツール結果を得たあとの「訪問 URL 追跡 / URL 変化検知 /
 * artifact 展開」などは呼び出し側で callback として処理する。本関数は
 * ツール実行・エラー包装・セキュリティ処理・履歴文字列の整形だけに責務を絞る。
 */
export async function executeToolWithTracking(
  args: ExecuteToolArgs,
): Promise<ExecuteToolResult> {
  const {
    toolCall,
    browser,
    toolExecutor,
    securityMiddleware,
    securityEnabled,
    sessionId,
    spaDetectedDomains,
    onConsoleStart,
    onConsoleLog,
    onSecurityBlocked,
  } = args;
  const { name, args: toolArgs } = toolCall;

  log.debug("tool-call", { name, args: toolArgs });

  let toolResult: Result<unknown, AppError>;
  try {
    toolResult = await toolExecutor(name, toolArgs, browser, undefined, {
      onConsoleStart: name === "repl" ? onConsoleStart : undefined,
      onConsoleLog: name === "repl" ? onConsoleLog : undefined,
    });
  } catch (e: unknown) {
    toolResult = {
      ok: false,
      error: {
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let fullResult = toolResult.ok
    ? JSON.stringify(toolResult.value)
    : `Error: ${toolResult.error.message}`;

  if (securityEnabled && !fullResult.includes("data:image/")) {
    const securityResult = await securityMiddleware.processToolOutput(fullResult, {
      source: name,
      sessionId,
    });

    if (securityResult.alert) {
      onSecurityBlocked?.();
      const blockedPayload = {
        securityAlert: {
          kind: securityResult.alert.kind,
          confidence: securityResult.alert.confidence,
          matches: securityResult.alert.matches,
          message: securityResult.alert.message,
        },
      };
      fullResult = JSON.stringify(blockedPayload);
      toolResult = toolResult.ok
        ? { ok: true, value: blockedPayload }
        : {
            ok: false,
            error: {
              code: "tool_output_blocked",
              message: "Security middleware blocked suspicious tool output.",
            },
          };
    }
  }

  if (fullResult.includes("data:image/")) {
    fullResult = "[screenshot captured]";
  }

  // bg_fetch 限定: 既知 SPA ドメインへの再取得を検出して警告を追記し、
  // 新しい SPA ドメインは spaDetectedDomains に蓄積する（in-place 更新）
  if (name === "bg_fetch" && toolResult.ok) {
    fullResult += trackSpaDomainsFromBgFetch(spaDetectedDomains, toolResult.value);
  }

  return { toolResult, fullResult };
}
