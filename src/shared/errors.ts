/** アプリケーション全体の回復可能エラーの基底型 */
export interface AppError {
  code: string;
  message: string;
  cause?: unknown;
}

/** AI API 関連エラー */
export interface AIError extends AppError {
  code:
    | "ai_rate_limit"
    | "ai_auth_invalid"
    | "ai_model_not_found"
    | "ai_payload_too_large"
    | "ai_network"
    | "ai_unknown";
}

/** 認証関連エラー */
export interface AuthError extends AppError {
  code: "auth_expired" | "auth_refresh_failed" | "auth_cancelled" | "auth_network";
}

/** ツール実行関連エラー */
export interface ToolError extends AppError {
  code: "tool_tab_not_found" | "tool_script_error" | "tool_timeout" | "tool_picker_cancelled";
}

/** Background 通信エラー */
export interface BrowserError extends AppError {
  code: "browser_tab_closed" | "browser_permission_denied" | "browser_navigation_timeout";
}

export type Result<T, E extends AppError = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends AppError>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
