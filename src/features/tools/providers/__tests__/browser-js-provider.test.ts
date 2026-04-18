import { describe, expect, it, vi } from "vitest";
import { BrowserJsProvider } from "../browser-js-provider";
import type { BrowserExecutor, ScriptResult, TabInfo } from "@/ports/browser-executor";
import type { ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";

type ExecuteScriptResult = Result<ScriptResult, ToolError>;

function makeBrowser(
  executeScriptImpl: () => Promise<ExecuteScriptResult>,
  tab: Partial<TabInfo> = {},
): BrowserExecutor {
  return {
    getActiveTab: vi.fn(async () => ({ id: 1, url: "https://example.com", title: "", ...tab })),
    executeScript: executeScriptImpl,
  } as unknown as BrowserExecutor;
}

function makeContext(browser: BrowserExecutor): ProviderContext {
  return { browser, artifactStorage: {} as ProviderContext["artifactStorage"] };
}

describe("BrowserJsProvider.handleRequest", () => {
  it("unwraps ScriptResult so the sandbox receives the raw user return (not {value: ...})", async () => {
    const browser = makeBrowser(async () => ok({ value: { title: "Hello", count: 3 } }));

    const provider = new BrowserJsProvider();
    const result = await provider.handleRequest(
      { id: "req-1", action: "browserjs", code: "() => ({ title: 'Hello', count: 3 })", args: [] },
      makeContext(browser),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ユーザの関数が返した object がそのまま見える（.value ラップされない）
    expect(result.value).toEqual({ title: "Hello", count: 3 });
  });

  it("unwraps primitives", async () => {
    const browser = makeBrowser(async () => ok({ value: 42 }));

    const provider = new BrowserJsProvider();
    const result = await provider.handleRequest(
      { id: "req-2", action: "browserjs", code: "() => 42", args: [] },
      makeContext(browser),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(42);
  });

  it("returns err when the tab has no id", async () => {
    const browser = {
      getActiveTab: vi.fn(async () => ({ id: null, url: "", title: "" })),
      executeScript: vi.fn(),
    } as unknown as BrowserExecutor;

    const provider = new BrowserJsProvider();
    const result = await provider.handleRequest(
      { id: "req-3", action: "browserjs", code: "() => 1", args: [] },
      makeContext(browser),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tool_tab_not_found");
  });

  it("propagates executeScript errors", async () => {
    const browser = makeBrowser(async () =>
      err({ code: "tool_script_error", message: "Script timeout" }),
    );

    const provider = new BrowserJsProvider();
    const result = await provider.handleRequest(
      { id: "req-4", action: "browserjs", code: "() => { while(1); }", args: [] },
      makeContext(browser),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("timeout");
  });
});
