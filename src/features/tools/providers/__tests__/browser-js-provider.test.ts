import { describe, expect, it, vi } from "vitest";
import { BrowserJsProvider, buildSkillInjection } from "../browser-js-provider";
import type { BrowserExecutor, ScriptResult, TabInfo } from "@/ports/browser-executor";
import type { ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import type { SkillMatch } from "@/shared/skill-types";
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

  it("prepends skill extractor injection so window[skillId][extractorId] is callable", async () => {
    let receivedCode = "";
    const browser = makeBrowser(async () => ok({ value: "ok" }));
    (browser.executeScript as unknown) = vi.fn(async (_tabId: number, code: string) => {
      receivedCode = code;
      return ok({ value: "ok" });
    });

    const skillMatches: SkillMatch[] = [
      {
        skill: {
          id: "x-post-helper",
          name: "X Post Helper",
          description: "X投稿フォーム操作",
          matchers: { hosts: ["x.com"] },
          version: "1.0.0",
          extractors: [
            {
              id: "check-post-form",
              name: "Check Post Form",
              description: "投稿フォーム存在確認",
              code: "function () { return !!document.querySelector('[data-testid=\"tweetTextarea_0\"]'); }",
              outputSchema: "boolean",
            },
          ],
        },
        availableExtractors: [
          {
            id: "check-post-form",
            name: "Check Post Form",
            description: "投稿フォーム存在確認",
            code: "function () { return !!document.querySelector('[data-testid=\"tweetTextarea_0\"]'); }",
            outputSchema: "boolean",
          },
        ],
        confidence: 100,
      },
    ];

    const provider = new BrowserJsProvider();
    await provider.handleRequest(
      {
        id: "req-5",
        action: "browserjs",
        code: '() => window["x-post-helper"]["check-post-form"]()',
        args: [],
      },
      { ...makeContext(browser), skillMatches },
    );

    expect(receivedCode).toContain('window["x-post-helper"] = window["x-post-helper"] || {};');
    expect(receivedCode).toContain('window["x-post-helper"]["check-post-form"] = (function ()');
  });

  it("does not inject anything when skillMatches is empty or undefined", async () => {
    let receivedCode = "";
    const browser = makeBrowser(async () => ok({ value: 1 }));
    (browser.executeScript as unknown) = vi.fn(async (_tabId: number, code: string) => {
      receivedCode = code;
      return ok({ value: 1 });
    });

    const provider = new BrowserJsProvider();
    await provider.handleRequest(
      { id: "req-6", action: "browserjs", code: "() => 1", args: [] },
      makeContext(browser),
    );

    expect(receivedCode).not.toContain("window[");
  });
});

describe("buildSkillInjection", () => {
  it("returns empty string when no matches", () => {
    expect(buildSkillInjection()).toBe("");
    expect(buildSkillInjection([])).toBe("");
  });

  it("handles ids with hyphens via bracket notation", () => {
    const injection = buildSkillInjection([
      {
        skill: {
          id: "x-post-helper",
          name: "X",
          description: "x",
          matchers: { hosts: ["x.com"] },
          version: "1.0.0",
          extractors: [],
        },
        availableExtractors: [
          {
            id: "check-post-form",
            name: "c",
            description: "d",
            code: "function () { return 1; }",
            outputSchema: "number",
          },
        ],
        confidence: 100,
      },
    ]);
    expect(injection).toContain('window["x-post-helper"]["check-post-form"]');
    expect(injection).toContain("(function () { return 1; })");
  });
});
