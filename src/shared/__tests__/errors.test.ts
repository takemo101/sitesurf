import { describe, expect, it } from "vitest";
import { ok, err } from "../errors";
import type { Result, AppError, AIError, AuthError, ToolError, BrowserError } from "../errors";

describe("Result型ヘルパー", () => {
  it("ok() は ok: true と value を返す", () => {
    const result = ok(42);
    expect(result).toStrictEqual({ ok: true, value: 42 });
  });

  it("ok() は任意の型を包める", () => {
    const result = ok({ name: "test", items: [1, 2] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("test");
    }
  });

  it("err() は ok: false と error を返す", () => {
    const error: AIError = {
      code: "ai_rate_limit",
      message: "Rate limit exceeded",
    };
    const result = err(error);
    expect(result).toStrictEqual({ ok: false, error });
  });

  it("err() に cause を含められる", () => {
    const original = new Error("network failure");
    const error: BrowserError = {
      code: "browser_tab_closed",
      message: "Tab was closed",
      cause: original,
    };
    const result = err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.cause).toBe(original);
    }
  });

  it("Result型は型安全に分岐できる", () => {
    function divide(a: number, b: number): Result<number, AppError> {
      if (b === 0) return err({ code: "division_by_zero", message: "Cannot divide by zero" });
      return ok(a / b);
    }

    const success = divide(10, 2);
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.value).toBe(5);
    }

    const failure = divide(10, 0);
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.code).toBe("division_by_zero");
    }
  });

  it("各エラー型は正しいcodeを持てる", () => {
    const aiErr: AIError = { code: "ai_network", message: "Network error" };
    const authErr: AuthError = { code: "auth_expired", message: "Token expired" };
    const toolErr: ToolError = { code: "tool_timeout", message: "Timeout" };
    const browserErr: BrowserError = { code: "browser_permission_denied", message: "Denied" };

    expect(err(aiErr).ok).toBe(false);
    expect(err(authErr).ok).toBe(false);
    expect(err(toolErr).ok).toBe(false);
    expect(err(browserErr).ok).toBe(false);
  });
});
